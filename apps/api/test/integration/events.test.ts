import request from 'supertest'
import { count, eq } from 'drizzle-orm'
import { deliveries, events } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { queue } from '../../src/queue/client.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'

const app = createApp()

describe('POST /v1/events idempotency', () => {
  let tenantId: string
  let apiKey: string

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
  })

  afterAll(async () => {
    await queue.obliterate({ force: true })
    await queue.close()
    await deleteTenant(tenantId)
    await closePool()
    await closeRedis()
  })

  it('returns the same event without duplicating deliveries or jobs', async () => {
    const body = { idempotency_key: 'test-1', type: 'test', payload: {} }

    const first = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${apiKey}`)
      .send(body)

    const second = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${apiKey}`)
      .send(body)

    expect(first.status).toBe(202)
    expect(second.status).toBe(202)
    expect(first.body.id).toBe(second.body.id)

    const db = getDb()
    const tenantEvents = eq(events.tenantId, tenantId)
    const tenantDeliveries = eq(deliveries.tenantId, tenantId)

    const [eventCount] = await db.select({ value: count() }).from(events).where(tenantEvents)
    const [deliveryCount] = await db
      .select({ value: count() })
      .from(deliveries)
      .where(tenantDeliveries)

    expect(eventCount.value).toBe(1)
    expect(deliveryCount.value).toBe(1)

    const [delivery] = await db
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(tenantDeliveries)

    const job = await queue.getJob(delivery.id)
    expect(job).not.toBeNull()
    expect(job?.id).toBe(delivery.id)
    expect(job?.data).toEqual({ deliveryId: delivery.id })
  })

  it('completes an event immediately when there are no active endpoints', async () => {
    const tenantWithoutEndpoints = await createTenantWithKey()

    try {
      const created = await request(app)
        .post('/v1/events')
        .set('Authorization', `Bearer ${tenantWithoutEndpoints.apiKey}`)
        .send({ idempotency_key: 'no-endpoints', type: 'test', payload: {} })

      expect(created.status).toBe(202)
      expect(created.body.status).toBe('completed')

      const detail = await request(app)
        .get(`/v1/events/${created.body.id}`)
        .set('Authorization', `Bearer ${tenantWithoutEndpoints.apiKey}`)

      expect(detail.status).toBe(200)
      expect(detail.body).toMatchObject({
        status: 'completed',
        deliveries_summary: { total: 0 },
      })
    } finally {
      await deleteTenant(tenantWithoutEndpoints.tenantId)
    }
  })
})
