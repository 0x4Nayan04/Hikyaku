import request from 'supertest'
import { eq } from 'drizzle-orm'
import { deliveries } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { queue } from '../../src/queue/client.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'

const app = createApp()

describe('tenant isolation (#4)', () => {
  let acme: { tenantId: string; apiKey: string }
  let globex: { tenantId: string; apiKey: string }
  let acmeDeliveryId: string

  beforeAll(async () => {
    await queue.pause()
    try {
      await queue.obliterate({ force: true })
    } finally {
      await queue.resume()
    }

    acme = await createTenantWithKey()
    globex = await createTenantWithKey()

    const acmeEndpoint = await request(app)
      .post('/v1/endpoints')
      .set('Authorization', `Bearer ${acme.apiKey}`)
      .send({ url: 'https://example.com/acme-hook' })

    expect(acmeEndpoint.status).toBe(201)

    const globexEndpoint = await request(app)
      .post('/v1/endpoints')
      .set('Authorization', `Bearer ${globex.apiKey}`)
      .send({ url: 'https://example.com/globex-hook' })

    expect(globexEndpoint.status).toBe(201)

    const ingest = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${acme.apiKey}`)
      .send({
        idempotency_key: 'tenant-isolation-acme',
        type: 'test.event',
        payload: { source: 'acme' },
      })

    expect(ingest.status).toBe(202)

    const db = getDb()
    const [delivery] = await db
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(eq(deliveries.tenantId, acme.tenantId))

    acmeDeliveryId = delivery.id
  })

  afterAll(async () => {
    await queue.pause()
    try {
      await queue.obliterate({ force: true })
    } finally {
      await queue.resume()
    }
    await queue.close()
    await deleteTenant(acme.tenantId)
    await deleteTenant(globex.tenantId)
    await closePool()
    await closeRedis()
  })

  it('returns 404 when another tenant requests a delivery by id', async () => {
    const res = await request(app)
      .get(`/v1/deliveries/${acmeDeliveryId}`)
      .set('Authorization', `Bearer ${globex.apiKey}`)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({
      error: { code: 'not_found' },
    })
  })
})
