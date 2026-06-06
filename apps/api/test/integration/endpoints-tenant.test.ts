import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'

const app = createApp()

describe('endpoints tenant isolation', () => {
  let acme: { tenantId: string; apiKey: string }
  let globex: { tenantId: string; apiKey: string }
  let acmeEndpointId: string

  beforeAll(async () => {
    acme = await createTenantWithKey()
    globex = await createTenantWithKey()

    const created = await request(app)
      .post('/v1/endpoints')
      .set('Authorization', `Bearer ${acme.apiKey}`)
      .send({ url: 'https://example.com/acme-hook', description: 'acme only' })

    acmeEndpointId = created.body.id
  })

  afterAll(async () => {
    await deleteTenant(acme.tenantId)
    await deleteTenant(globex.tenantId)
    await closePool()
    await closeRedis()
  })

  it('returns 404 when another tenant patches an endpoint by id', async () => {
    const res = await request(app)
      .patch(`/v1/endpoints/${acmeEndpointId}`)
      .set('Authorization', `Bearer ${globex.apiKey}`)
      .send({ status: 'disabled' })

    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      error: { code: 'not_found', message: 'Endpoint not found' },
    })
  })

  it('does not list another tenant endpoints', async () => {
    const res = await request(app)
      .get('/v1/endpoints')
      .set('Authorization', `Bearer ${globex.apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
    expect(res.body.data).toEqual([])
  })

  it('still returns the endpoint for the owning tenant', async () => {
    const res = await request(app)
      .get('/v1/endpoints')
      .set('Authorization', `Bearer ${acme.apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.data[0].id).toBe(acmeEndpointId)
    expect(res.body.data[0].secret).toBeUndefined()
  })
})
