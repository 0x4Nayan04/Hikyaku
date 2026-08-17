import { QUEUE_NAME } from '@webhook/shared/constants'
import { deliveries, endpoints, events, tenants } from '@webhook/shared/schema'
import { Queue, Worker } from 'bullmq'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis, getRedisConnectionOptions } from '../../src/lib/redis.js'
import { enqueueDelivery } from '../../src/queue/client.js'
import { sweepOrphanDeliveries } from '../../src/sweeper.js'

const queue = new Queue(`${QUEUE_NAME}-sweeper-test-${process.pid}`, {
  connection: getRedisConnectionOptions(),
})

async function clearQueue(): Promise<void> {
  await queue.pause()
  try {
    await queue.obliterate({ force: true })
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
  await db.delete(deliveries).where(inArray(deliveries.status, ['pending', 'in_progress']))
}

describe('sweepOrphanDeliveries', () => {
  beforeEach(async () => {
    await clearQueue()
    await clearOrphanCandidates()
  })

  afterAll(async () => {
    await clearQueue()
    await queue.close()
    await closePool()
    await closeRedis()
  })

  it('re-enqueues pending deliveries missing from the queue', async () => {
    const seeded = await seedPendingDelivery()

    await sweepOrphanDeliveries(queue)

    const job = await findDeliveryJob(seeded.id)
    expect(job).toBeDefined()
    expect(job?.data).toEqual({ deliveryId: seeded.id, tenantId: seeded.tenantId })
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

  it('drains remaining eligible deliveries after each 100-row batch', async () => {
    const seeded = await seedPendingDeliveries(101)

    await sweepOrphanDeliveries(queue)

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active'])
    expect(jobs).toHaveLength(101)
    expect(jobs.map((job) => job.data.deliveryId).sort()).toEqual(seeded.map((row) => row.id).sort())
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
    await enqueueDelivery(seeded.id, seeded.tenantId, queue)

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
    await enqueueDelivery(seeded.id, seeded.tenantId, queue)

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
    await db.update(deliveries).set({ status: 'in_progress' }).where(eq(deliveries.id, seeded.id))

    await sweepOrphanDeliveries(queue)

    const [row] = await db
      .select({ status: deliveries.status })
      .from(deliveries)
      .where(eq(deliveries.id, seeded.id))
    expect(row?.status).toBe('pending')

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
