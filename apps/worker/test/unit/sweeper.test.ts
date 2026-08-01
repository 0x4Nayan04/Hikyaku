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

async function seedPendingDelivery(): Promise<string> {
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
  const [event] = await db
    .insert(events)
    .values({
      tenantId: tenant.id,
      idempotencyKey: `sweeper-${crypto.randomUUID()}`,
      type: 'test',
      payload: {},
    })
    .returning()
  const [delivery] = await db
    .insert(deliveries)
    .values({
      tenantId: tenant.id,
      eventId: event.id,
      endpointId: endpoint.id,
      status: 'pending',
    })
    .returning({ id: deliveries.id })

  return delivery.id
}

async function clearOrphanCandidates(): Promise<void> {
  const db = getDb()
  await db
    .delete(deliveries)
    .where(inArray(deliveries.status, ['pending', 'deferred', 'in_progress']))
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
    const deliveryId = await seedPendingDelivery()

    await sweepOrphanDeliveries(queue)

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active'])
    const job = jobs.find((row) => row.id === deliveryId)
    expect(job).toBeDefined()
    expect(job?.data).toEqual({ deliveryId })
  })

  it('re-enqueues deferred deliveries missing from the queue', async () => {
    const deliveryId = await seedPendingDelivery()
    const db = getDb()
    await db.update(deliveries).set({ status: 'deferred' }).where(eq(deliveries.id, deliveryId))

    await sweepOrphanDeliveries(queue)

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active'])
    expect(jobs.some((row) => row.id === deliveryId)).toBe(true)
  })

  it('skips deliveries that already have an in-flight queue job', async () => {
    const deliveryId = await seedPendingDelivery()
    await enqueueDelivery(deliveryId, queue)

    await sweepOrphanDeliveries(queue)

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active'])
    const matching = jobs.filter(
      (job) => job.id === deliveryId || job.data.deliveryId === deliveryId,
    )
    expect(matching).toHaveLength(1)
  })

  it('does not re-enqueue terminal deliveries', async () => {
    const deliveryId = await seedPendingDelivery()
    const db = getDb()
    await db.update(deliveries).set({ status: 'succeeded' }).where(eq(deliveries.id, deliveryId))

    await sweepOrphanDeliveries(queue)

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active'])
    expect(jobs.some((row) => row.id === deliveryId)).toBe(false)
  })

  it('re-enqueues when a failed BullMQ job still occupies the delivery jobId', async () => {
    const deliveryId = await seedPendingDelivery()
    await enqueueDelivery(deliveryId, queue)

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

    const requeued = await queue.getJob(deliveryId)
    expect(requeued).toBeDefined()
    expect(await requeued!.getState()).toBe('waiting')
  })

  it('re-enqueues stuck in_progress deliveries missing from the queue', async () => {
    const deliveryId = await seedPendingDelivery()
    const db = getDb()
    await db.update(deliveries).set({ status: 'in_progress' }).where(eq(deliveries.id, deliveryId))

    await sweepOrphanDeliveries(queue)

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active'])
    expect(jobs.some((row) => row.id === deliveryId)).toBe(true)
  })
})
