import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'

const app = createApp()

describe('auth', () => {
  let acme: { tenantId: string; apiKey: string }
  let globex: { tenantId: string; apiKey: string }

  beforeAll(async () => {
    acme = await createTenantWithKey()
    globex = await createTenantWithKey()
  })

  afterAll(async () => {
    await deleteTenant(acme.tenantId)
    await deleteTenant(globex.tenantId)
    await closePool()
    await closeRedis()
  })

  it('returns 200 for a valid api key on GET /v1/stats', async () => {
    const res = await request(app).get('/v1/stats').set('Authorization', `Bearer ${acme.apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      events_today: 0,
      deliveries_active: 0,
      deliveries_deferred: 0,
      deliveries_succeeded_24h: 0,
      deliveries_failed_24h: 0,
      success_rate_24h: null,
    })
  })

  it('returns 200 for a second tenant api key on GET /v1/stats', async () => {
    const res = await request(app).get('/v1/stats').set('Authorization', `Bearer ${globex.apiKey}`)

    expect(res.status).toBe(200)
  })

  it('returns 401 for an invalid api key on GET /v1/stats', async () => {
    const res = await request(app).get('/v1/stats').set('Authorization', 'Bearer invalid')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      error: { code: 'unauthorized', message: 'Missing or invalid Bearer token' },
    })
  })

  it('returns 404 for cross-tenant access on GET /v1/tenants/:tenantId', async () => {
    const res = await request(app)
      .get(`/v1/tenants/${acme.tenantId}`)
      .set('Authorization', `Bearer ${globex.apiKey}`)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      error: { code: 'not_found', message: 'Not found' },
    })
  })

  it('returns 200 when accessing the authenticated tenant on GET /v1/tenants/:tenantId', async () => {
    const res = await request(app)
      .get(`/v1/tenants/${acme.tenantId}`)
      .set('Authorization', `Bearer ${acme.apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: acme.tenantId })
  })
})
