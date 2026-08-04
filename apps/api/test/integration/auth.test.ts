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

  it('allows API keys only for event ingestion', async () => {
    const managementResponses = await Promise.all(
      ['/api-keys', '/endpoints', '/events', '/deliveries', '/stats'].map((path) =>
        request(app).get(`/v1${path}`).set('Authorization', `Bearer ${acme.apiKey}`),
      ),
    )

    expect(managementResponses.map((response) => response.status)).toEqual([
      401, 401, 401, 401, 401,
    ])

    const res = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${acme.apiKey}`)
      .send({ idempotency_key: 'api-key-ingest', type: 'test', payload: {} })

    expect(res.status).toBe(202)
  })

  it('rejects a second tenant API key on a management route', async () => {
    const res = await request(app).get('/v1/stats').set('Authorization', `Bearer ${globex.apiKey}`)

    expect(res.status).toBe(401)
  })

  it('returns 401 for an invalid api key on GET /v1/stats', async () => {
    const res = await request(app).get('/v1/stats').set('Authorization', 'Bearer invalid')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Missing or invalid Bearer token or session',
      },
    })
  })
})
