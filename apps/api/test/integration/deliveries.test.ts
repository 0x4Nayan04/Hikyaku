import request from 'supertest'
import { eq } from 'drizzle-orm'
import { deliveries, deliveryAttempts } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { queue } from '../../src/queue/client.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'

const app = createApp()

describe('GET /v1/deliveries', () => {
  let tenantId: string
  let apiKey: string
  let deliveryId: string
  let eventId: string
  let endpointId: string

  beforeAll(async () => {
    await queue.obliterate({ force: true })

    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    apiKey = tenant.apiKey

    const endpointRes = await request(app)
      .post('/v1/endpoints')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ url: 'https://webhook.site/test' })

    expect(endpointRes.status).toBe(201)
    endpointId = endpointRes.body.id

    const eventRes = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ idempotency_key: 'delivery-list-test', type: 'test', payload: { ok: true } })

    expect(eventRes.status).toBe(202)
    eventId = eventRes.body.id

    const db = getDb()
    const [delivery] = await db
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(eq(deliveries.tenantId, tenantId))

    deliveryId = delivery.id

    await db.insert(deliveryAttempts).values({
      deliveryId,
      attemptNumber: 1,
      httpStatus: 200,
      responseBody: '{"ok":true}',
      error: null,
      durationMs: 145,
    })
  })

  afterAll(async () => {
    await queue.obliterate({ force: true })
    await queue.close()
    await deleteTenant(tenantId)
    await closePool()
    await closeRedis()
  })

  it('lists deliveries for the authenticated tenant', async () => {
    const res = await request(app).get('/v1/deliveries').set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      total: 1,
      limit: 50,
      offset: 0,
    })
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({
      id: deliveryId,
      event_id: eventId,
      endpoint_id: endpointId,
      status: 'pending',
      attempt_count: 0,
      next_retry_at: null,
      last_error: null,
    })
    expect(res.body.data[0].created_at).toEqual(expect.any(String))
    expect(res.body.data[0].updated_at).toEqual(expect.any(String))
  })

  it('filters deliveries by status', async () => {
    const res = await request(app)
      .get('/v1/deliveries?status=pending')
      .set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].id).toBe(deliveryId)

    const empty = await request(app)
      .get('/v1/deliveries?status=succeeded')
      .set('Authorization', `Bearer ${apiKey}`)

    expect(empty.status).toBe(200)
    expect(empty.body.data).toHaveLength(0)
    expect(empty.body.total).toBe(0)
  })

  it('returns delivery detail with attempt timeline', async () => {
    const res = await request(app)
      .get(`/v1/deliveries/${deliveryId}`)
      .set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: deliveryId,
      event_id: eventId,
      endpoint_id: endpointId,
      status: 'pending',
      attempt_count: 0,
      next_retry_at: null,
      last_error: null,
    })
    expect(res.body.attempts).toHaveLength(1)
    expect(res.body.attempts[0]).toMatchObject({
      attempt_number: 1,
      http_status: 200,
      response_body: '{"ok":true}',
      error: null,
      duration_ms: 145,
    })
    expect(res.body.attempts[0].created_at).toEqual(expect.any(String))
  })

  it('returns 404 for a missing delivery', async () => {
    const res = await request(app)
      .get('/v1/deliveries/880e8400-e29b-41d4-a716-446655440099')
      .set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      error: { code: 'not_found', message: 'Delivery not found' },
    })
  })
})
