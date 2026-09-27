import request from 'supertest'
import { eq } from 'drizzle-orm'
import { deliveries, deliveryAttempts, endpoints, events } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { queue } from '../../src/queue/client.js'
import { createApp } from '../../src/server.js'
import {
  beginDeliveryTestIsolation,
  endDeliveryTestIsolation,
  seedDeliveryRow,
} from '../helpers/delivery.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createTenantSession } from '../helpers/user.js'

const app = createApp()

describe('POST /v1/deliveries/:id/replay', () => {
  let tenantId: string
  let deliveryId: string
  let eventId: string
  let agent: ReturnType<typeof request.agent>

  beforeAll(async () => {
    await beginDeliveryTestIsolation()

    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    agent = await createTenantSession(app, tenantId)

    const seeded = await seedDeliveryRow({
      tenantId,
      idempotencyKey: 'replay-test',
      endpointUrl: 'https://webhook.site/replay-test',
      eventStatus: 'failed',
      deliveryStatus: 'failed',
      attemptCount: 5,
      lastError: 'http_500',
    })
    eventId = seeded.eventId
    deliveryId = seeded.deliveryId

    await getDb().insert(deliveryAttempts).values({
      deliveryId,
      attemptNumber: 5,
      httpStatus: 500,
      error: 'http_500',
      durationMs: 10,
    })
  })

  afterAll(async () => {
    await endDeliveryTestIsolation()
    await queue.close()
    await deleteTenant(tenantId)
    await closePool()
    await closeRedis()
  })

  it('replays a failed delivery and re-enqueues a job', async () => {
    const res = await agent.post(`/v1/deliveries/${deliveryId}/replay`)

    expect(res.status).toBe(202)
    expect(res.body).toEqual({ id: deliveryId, status: 'pending' })

    const db = getDb()
    const jobs = await queue.getJobs(['waiting', 'active', 'delayed'])
    const job = jobs.find((candidate) => candidate.data.deliveryId === deliveryId)
    expect(job).toBeDefined()
    expect(job?.data).toEqual({ deliveryId, tenantId })
    expect(['waiting', 'active', 'delayed']).toContain(await job?.getState())

    const [delivery] = await db
      .select({
        status: deliveries.status,
        attemptCount: deliveries.attemptCount,
        lastError: deliveries.lastError,
        nextRetryAt: deliveries.nextRetryAt,
      })
      .from(deliveries)
      .where(eq(deliveries.id, deliveryId))

    expect(delivery).toMatchObject({
      attemptCount: 0,
      lastError: null,
      nextRetryAt: null,
    })
    expect(['pending', 'in_progress']).toContain(delivery.status)

    const attempts = await db
      .select({ attemptNumber: deliveryAttempts.attemptNumber })
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, deliveryId))
    expect(attempts).toEqual([{ attemptNumber: 5 }])

    const [event] = await db
      .select({ status: events.status })
      .from(events)
      .where(eq(events.id, eventId))

    expect(event.status).toBe('pending')
  })

  it('re-enqueues a pending delivery without resetting its run', async () => {
    const retryAt = new Date(Date.now() + 120_000)
    await getDb()
      .update(deliveries)
      .set({
        status: 'pending',
        attemptCount: 2,
        replayCount: 1,
        nextRetryAt: retryAt,
        lastError: 'http_503',
      })
      .where(eq(deliveries.id, deliveryId))

    const res = await agent.post(`/v1/deliveries/${deliveryId}/replay`)

    expect(res.status).toBe(202)
    expect(res.body).toEqual({ id: deliveryId, status: 'pending' })

    const [delivery] = await getDb()
      .select({
        status: deliveries.status,
        attemptCount: deliveries.attemptCount,
        replayCount: deliveries.replayCount,
        nextRetryAt: deliveries.nextRetryAt,
        lastError: deliveries.lastError,
      })
      .from(deliveries)
      .where(eq(deliveries.id, deliveryId))

    expect(delivery).toMatchObject({
      status: 'pending',
      attemptCount: 2,
      replayCount: 1,
      lastError: 'http_503',
    })
    expect(delivery?.nextRetryAt?.getTime()).toBe(retryAt.getTime())
  })

  it('rejects an in-progress replay without mutating the delivery or enqueueing a job', async () => {
    const retryAt = new Date(Date.now() + 120_000)
    await getDb()
      .update(deliveries)
      .set({
        status: 'in_progress',
        attemptCount: 2,
        replayCount: 1,
        nextRetryAt: retryAt,
        lastError: 'http_503',
      })
      .where(eq(deliveries.id, deliveryId))

    for (const job of await queue.getJobs(['waiting', 'delayed', 'active', 'paused'])) {
      if (job.data.deliveryId === deliveryId) await job.remove()
    }

    const res = await agent.post(`/v1/deliveries/${deliveryId}/replay`)

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('invalid_state')
    expect(res.body.error.message).toContain('sweeper')

    const [delivery] = await getDb()
      .select({
        status: deliveries.status,
        attemptCount: deliveries.attemptCount,
        replayCount: deliveries.replayCount,
        nextRetryAt: deliveries.nextRetryAt,
        lastError: deliveries.lastError,
      })
      .from(deliveries)
      .where(eq(deliveries.id, deliveryId))

    expect(delivery).toMatchObject({
      status: 'in_progress',
      attemptCount: 2,
      replayCount: 1,
      lastError: 'http_503',
    })
    expect(delivery?.nextRetryAt?.getTime()).toBe(retryAt.getTime())

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active', 'paused'])
    expect(jobs.some((job) => job.data.deliveryId === deliveryId)).toBe(false)
  })

  it('rejects replay of a succeeded delivery', async () => {
    const seeded = await seedDeliveryRow({
      tenantId,
      idempotencyKey: 'replay-succeeded',
      deliveryStatus: 'succeeded',
      eventStatus: 'completed',
    })

    const res = await agent.post(`/v1/deliveries/${seeded.deliveryId}/replay`)

    expect(res.status).toBe(400)
    expect(res.body.error).toMatchObject({
      code: 'invalid_state',
      message: 'Only failed deliveries can be replayed',
    })
  })

  it('rejects replay when the endpoint is disabled', async () => {
    const seeded = await seedDeliveryRow({
      tenantId,
      idempotencyKey: 'replay-disabled',
      deliveryStatus: 'pending',
      attemptCount: 1,
    })
    await getDb()
      .update(endpoints)
      .set({ status: 'disabled' })
      .where(eq(endpoints.id, seeded.endpointId))

    const res = await agent.post(`/v1/deliveries/${seeded.deliveryId}/replay`)

    expect(res.status).toBe(400)
    expect(res.body.error).toMatchObject({
      code: 'invalid_state',
      message: 'Endpoint is disabled',
    })

    const [delivery] = await getDb()
      .select({ status: deliveries.status, attemptCount: deliveries.attemptCount })
      .from(deliveries)
      .where(eq(deliveries.id, seeded.deliveryId))
    expect(delivery).toMatchObject({ status: 'pending', attemptCount: 1 })
  })

  it('returns 404 for cross-tenant replay', async () => {
    const other = await createTenantWithKey()
    try {
      const otherAgent = await createTenantSession(app, other.tenantId)
      const res = await otherAgent.post(`/v1/deliveries/${deliveryId}/replay`)

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('not_found')
    } finally {
      await deleteTenant(other.tenantId)
    }
  })
})
