import request from 'supertest'
import { eq } from 'drizzle-orm'
import { deliveries, events } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { queue } from '../../src/queue/client.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'

const app = createApp()

describe('POST /v1/deliveries/:id/replay', () => {
  let tenantId: string
  let apiKey: string
  let deliveryId: string
  let eventId: string

  beforeAll(async () => {
    await queue.obliterate({ force: true })

    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    apiKey = tenant.apiKey

    const endpointRes = await request(app)
      .post('/v1/endpoints')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ url: 'https://webhook.site/replay-test' })

    expect(endpointRes.status).toBe(201)

    const eventRes = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ idempotency_key: 'replay-test', type: 'test', payload: { ok: true } })

    expect(eventRes.status).toBe(202)
    eventId = eventRes.body.id

    const db = getDb()
    const [delivery] = await db
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(eq(deliveries.tenantId, tenantId))

    deliveryId = delivery.id

    await db
      .update(deliveries)
      .set({
        status: 'failed',
        lastError: 'http_500',
        attemptCount: 5,
        nextRetryAt: null,
      })
      .where(eq(deliveries.id, deliveryId))

    await db.update(events).set({ status: 'failed' }).where(eq(events.id, eventId))

    await queue.obliterate({ force: true })
  })

  afterAll(async () => {
    await queue.obliterate({ force: true })
    await queue.close()
    await deleteTenant(tenantId)
    await closePool()
    await closeRedis()
  })

  it('replays a failed delivery and re-enqueues a job', async () => {
    const res = await request(app)
      .post(`/v1/deliveries/${deliveryId}/replay`)
      .set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(202)
    expect(res.body).toEqual({ id: deliveryId, status: 'pending' })

    const db = getDb()
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
      status: 'pending',
      attemptCount: 0,
      lastError: null,
      nextRetryAt: null,
    })

    const [event] = await db
      .select({ status: events.status })
      .from(events)
      .where(eq(events.id, eventId))

    expect(event.status).toBe('pending')

    const job = await queue.getJob(deliveryId)
    expect(job).not.toBeNull()
    expect(job?.data).toEqual({ deliveryId })
  })

  it('rejects replay when delivery is not failed', async () => {
    const res = await request(app)
      .post(`/v1/deliveries/${deliveryId}/replay`)
      .set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(400)
    expect(res.body.error).toMatchObject({
      code: 'invalid_state',
      message: 'Only failed deliveries can be replayed',
    })
  })

  it('returns 404 for cross-tenant replay', async () => {
    const other = await createTenantWithKey()
    try {
      const res = await request(app)
        .post(`/v1/deliveries/${deliveryId}/replay`)
        .set('Authorization', `Bearer ${other.apiKey}`)

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('not_found')
    } finally {
      await deleteTenant(other.tenantId)
    }
  })
})
