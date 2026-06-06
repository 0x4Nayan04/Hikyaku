import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'

const app = createApp()

describe('endpoints', () => {
  let tenantId: string
  let apiKey: string
  let endpointId: string
  let endpointSecret: string

  beforeAll(async () => {
    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    apiKey = tenant.apiKey
  })

  afterAll(async () => {
    await deleteTenant(tenantId)
    await closePool()
    await closeRedis()
  })

  it('creates an endpoint and returns the secret once', async () => {
    const res = await request(app)
      .post('/v1/endpoints')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ url: 'https://webhook.site/test', description: 'test' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      url: 'https://webhook.site/test',
      status: 'active',
      description: 'test',
    })
    expect(res.body.id).toEqual(expect.any(String))
    expect(res.body.created_at).toEqual(expect.any(String))
    expect(res.body.secret).toMatch(/^whsec_[0-9a-f]{32}$/)

    endpointId = res.body.id
    endpointSecret = res.body.secret
  })

  it('lists endpoints without the secret', async () => {
    const res = await request(app).get('/v1/endpoints').set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      total: 1,
      limit: 50,
      offset: 0,
    })
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({
      id: endpointId,
      url: 'https://webhook.site/test',
      status: 'active',
      description: 'test',
    })
    expect(res.body.data[0].secret).toBeUndefined()
    expect(res.body.data[0]).not.toHaveProperty('secret')
  })

  it('disables an endpoint', async () => {
    const res = await request(app)
      .patch(`/v1/endpoints/${endpointId}`)
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ status: 'disabled' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: endpointId,
      url: 'https://webhook.site/test',
      status: 'disabled',
      description: 'test',
    })
    expect(res.body.secret).toBeUndefined()
    expect(res.body).not.toHaveProperty('secret')
  })

  it('keeps the secret absent from list after disable', async () => {
    const res = await request(app).get('/v1/endpoints').set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body.data[0]).toMatchObject({
      id: endpointId,
      status: 'disabled',
    })
    expect(res.body.data[0].secret).toBeUndefined()
    expect(endpointSecret).toMatch(/^whsec_/)
  })
})
