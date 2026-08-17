import request from 'supertest'
import { eq } from 'drizzle-orm'
import { deliveries, deliveryAttempts, events } from '@webhook/shared/schema'
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
    expect(attempts).toEqual([])

    const [event] = await db
      .select({ status: events.status })
      .from(events)
      .where(eq(events.id, eventId))

    expect(event.status).toBe('pending')
  })

  it('returns the current state when a replay is already in flight', async () => {
    const res = await agent.post(`/v1/deliveries/${deliveryId}/replay`)

    expect(res.status).toBe(202)
    expect(res.body).toEqual({ id: deliveryId, status: 'pending' })

    await getDb()
      .update(deliveries)
      .set({ status: 'in_progress' })
      .where(eq(deliveries.id, deliveryId))

    const inProgress = await agent.post(`/v1/deliveries/${deliveryId}/replay`)
    expect(inProgress.status).toBe(202)
    expect(inProgress.body).toEqual({ id: deliveryId, status: 'in_progress' })
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
