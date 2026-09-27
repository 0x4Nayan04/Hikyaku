const seededTenantIds: string[] = []
import { QUEUE_NAME } from '@webhook/shared/constants'
import { enqueueDeliveryJob } from '@webhook/shared/enqueueDelivery'
import { deliveries, deliveryOutbox, endpoints, events, tenants } from '@webhook/shared/schema'
import { Queue, Worker } from 'bullmq'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis, getRedisConnectionOptions } from '../../src/lib/redis.js'
import { sweepOrphanDeliveries } from '../../src/sweeper.js'

const queue = new Queue(`${QUEUE_NAME}-sweeper-test-${process.pid}`, {
  connection: getRedisConnectionOptions(),
})

async function clearQueue(): Promise<void> {
  await queue.pause()
  try {
    for (const job of await queue.getJobs([
      'waiting',
      'delayed',
      'completed',
      'failed',
      'paused',
    ])) {
      await job.remove()
    }
  } finally {
    await queue.resume()
  }
}

async function findDeliveryJob(deliveryId: string) {
  const jobs = await queue.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed'])
  return jobs.find((job) => job.data.deliveryId === deliveryId)
}

async function seedPendingDeliveries(count = 1): Promise<{ id: string; tenantId: string }[]> {
  const db = getDb()
  const [tenant] = await db.insert(tenants).values({ name: 'sweeper-test' }).returning()
  seededTenantIds.push(tenant.id)
  const [endpoint] = await db
    .insert(endpoints)
    .values({
      tenantId: tenant.id,
      url: 'https://example.com/sweeper',
      secret: 'whsec_' + 'c'.repeat(32),
    })
    .returning()
  const seededEvents = await db
    .insert(events)
    .values(
      Array.from({ length: count }, () => ({
        tenantId: tenant.id,
        idempotencyKey: `sweeper-${crypto.randomUUID()}`,
        type: 'test',
        payload: {},
      })),
    )
    .returning()
  const seededDeliveries = await db
    .insert(deliveries)
    .values(
      seededEvents.map((event, index) => ({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
        status: 'pending',
        updatedAt: new Date(Date.now() - (6 * 60 + count - index) * 1000),
      })),
    )
    .returning({ id: deliveries.id, tenantId: deliveries.tenantId })

  return seededDeliveries
}

async function seedPendingDelivery(): Promise<{ id: string; tenantId: string }> {
  return (await seedPendingDeliveries())[0]!
}

async function clearOrphanCandidates(): Promise<void> {
  const db = getDb()
  if (seededTenantIds.length)
    await db.delete(tenants).where(inArray(tenants.id, seededTenantIds.splice(0)))
}

describe('sweepOrphanDeliveries', () => {
  beforeEach(async () => {
    await clearQueue()
    await clearOrphanCandidates()
  })

  afterAll(async () => {
    await clearQueue()
    await clearOrphanCandidates()
    await queue.close()
    await closePool()
    await closeRedis()
  })

  it('fixture cleanup preserves rows outside this test run', async () => {
    const [sentinel] = await getDb()
      .insert(tenants)
      .values({ name: 'outside-run-sentinel' })
      .returning()
    try {
      await seedPendingDelivery()
      await clearOrphanCandidates()
      expect(await getDb().select().from(tenants).where(eq(tenants.id, sentinel.id))).toHaveLength(
        1,
      )
    } finally {
      await getDb().delete(tenants).where(eq(tenants.id, sentinel.id))
    }
  })

  it('re-enqueues pending deliveries missing from the queue', async () => {
    const seeded = await seedPendingDelivery()

    await sweepOrphanDeliveries(queue)

    const job = await findDeliveryJob(seeded.id)
    expect(job).toBeDefined()
    expect(job?.data).toEqual({ deliveryId: seeded.id, tenantId: seeded.tenantId })
  })

  it('enqueues a fresh delivery that still has an outbox row', async () => {
    const seeded = await seedPendingDelivery()
    const db = getDb()
    await db.update(deliveries).set({ updatedAt: new Date() }).where(eq(deliveries.id, seeded.id))
    await db.insert(deliveryOutbox).values({ deliveryId: seeded.id, tenantId: seeded.tenantId })

    await sweepOrphanDeliveries(queue)

    const job = await findDeliveryJob(seeded.id)
    expect(job).toBeDefined()
    expect(job?.data).toEqual({ deliveryId: seeded.id, tenantId: seeded.tenantId })

    const leftover = await db
      .select({ deliveryId: deliveryOutbox.deliveryId })
      .from(deliveryOutbox)
      .where(eq(deliveryOutbox.deliveryId, seeded.id))
    expect(leftover).toEqual([])
    await sweepOrphanDeliveries(queue)
    const matching = (await queue.getJobs(['waiting', 'delayed', 'active'])).filter(
      (item) => item.data.deliveryId === seeded.id,
    )
    expect(matching).toHaveLength(1)
  })

  it('does not re-enqueue fresh or future-scheduled deliveries', async () => {
    const [fresh, futureRetry] = await seedPendingDeliveries(2)
    const db = getDb()
    await db.update(deliveries).set({ updatedAt: new Date() }).where(eq(deliveries.id, fresh.id))
    await db
      .update(deliveries)
      .set({ nextRetryAt: new Date(Date.now() + 60_000) })
      .where(eq(deliveries.id, futureRetry.id))

    await sweepOrphanDeliveries(queue)

    expect(await findDeliveryJob(fresh.id)).toBeUndefined()
    expect(await findDeliveryJob(futureRetry.id)).toBeUndefined()
  })

  it('recovers pending and stale in-progress deliveries in the same batch', async () => {
    const [pending, stale] = await seedPendingDeliveries(2)
    await getDb()
      .update(deliveries)
      .set({ status: 'in_progress' })
      .where(eq(deliveries.id, stale.id))

    await sweepOrphanDeliveries(queue)

    expect(await findDeliveryJob(pending.id)).toBeDefined()
    expect(await findDeliveryJob(stale.id)).toBeDefined()
    const recovered = await getDb()
      .select()
      .from(deliveries)
      .where(inArray(deliveries.id, [pending.id, stale.id]))
    expect(recovered.map((row) => row.status)).toEqual(['pending', 'pending'])
  })

  it('drains remaining eligible deliveries after each 100-row batch', async () => {
    const seeded = await seedPendingDeliveries(101)

    await sweepOrphanDeliveries(queue)

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active'])
    expect(jobs).toHaveLength(101)
    expect(jobs.map((job) => job.data.deliveryId).sort()).toEqual(
      seeded.map((row) => row.id).sort(),
    )
  }, 15_000)

  it('stops draining when the sweeper lock deadline has passed', async () => {
    await seedPendingDeliveries(101)

    await sweepOrphanDeliveries(queue, Date.now() - 1)

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active'])
    expect(jobs).toHaveLength(100)
  })

  it('re-enqueues rate-limited pending deliveries when nextRetryAt has passed', async () => {
    const seeded = await seedPendingDelivery()
    const db = getDb()
    await db
      .update(deliveries)
      .set({ lastError: 'rate_limited', nextRetryAt: new Date(Date.now() - 1_000) })
      .where(eq(deliveries.id, seeded.id))

    await sweepOrphanDeliveries(queue)

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active'])
    expect(jobs.some((row) => row.data.deliveryId === seeded.id)).toBe(true)
  })

  it('skips deliveries that already have an in-flight queue job', async () => {
    const seeded = await seedPendingDelivery()
    await enqueueDeliveryJob(queue, seeded.id, seeded.tenantId)

    await sweepOrphanDeliveries(queue)

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active'])
    const matching = jobs.filter((job) => job.data.deliveryId === seeded.id)
    expect(matching).toHaveLength(1)
  })

  it('does not re-enqueue terminal deliveries', async () => {
    const seeded = await seedPendingDelivery()
    const db = getDb()
    await db.update(deliveries).set({ status: 'succeeded' }).where(eq(deliveries.id, seeded.id))

    await sweepOrphanDeliveries(queue)

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active'])
    expect(jobs.some((row) => row.data.deliveryId === seeded.id)).toBe(false)
  })

  it('re-enqueues after a previous BullMQ job failed', async () => {
    const seeded = await seedPendingDelivery()
    await enqueueDeliveryJob(queue, seeded.id, seeded.tenantId)

    const worker = new Worker(queue.name, null, {
      connection: getRedisConnectionOptions(),
      autorun: false,
    })
    await worker.waitUntilReady()
    await queue.resume()
    const job = await worker.getNextJob('sweeper-test', { block: true })
    try {
      expect(job).toBeDefined()
      job!.discard()
      await job!.moveToFailed(new Error('exhausted'), 'sweeper-test')
    } finally {
      await worker.close()
    }

    await sweepOrphanDeliveries(queue)

    const jobs = await queue.getJobs(['waiting'])
    const requeued = jobs.find((candidate) => candidate.data.deliveryId === seeded.id)
    expect(requeued).toBeDefined()
    expect(await requeued!.getState()).toBe('waiting')
  })

  it('re-enqueues stuck in_progress deliveries missing from the queue', async () => {
    const seeded = await seedPendingDelivery()
    const db = getDb()
    const retryAt = new Date(Date.now() - 1_000)
    await db
      .update(deliveries)
      .set({ status: 'in_progress', attemptCount: 3, nextRetryAt: retryAt })
      .where(eq(deliveries.id, seeded.id))

    await sweepOrphanDeliveries(queue)

    const [row] = await db
      .select({
        status: deliveries.status,
        attemptCount: deliveries.attemptCount,
        nextRetryAt: deliveries.nextRetryAt,
      })
      .from(deliveries)
      .where(eq(deliveries.id, seeded.id))
    expect(row?.status).toBe('pending')
    expect(row?.attemptCount).toBe(3)
    expect(row?.nextRetryAt?.getTime()).toBe(retryAt.getTime())

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active'])
    expect(jobs.some((job) => job.data.deliveryId === seeded.id)).toBe(true)
  })

  it('does not reclaim an active delivery before its worker lock expires', async () => {
    const seeded = await seedPendingDelivery()
    const db = getDb()
    await db
      .update(deliveries)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(eq(deliveries.id, seeded.id))

    await sweepOrphanDeliveries(queue)

    const [row] = await db
      .select({ status: deliveries.status })
      .from(deliveries)
      .where(eq(deliveries.id, seeded.id))
    expect(row?.status).toBe('in_progress')
    expect(await findDeliveryJob(seeded.id)).toBeUndefined()
  })
})
