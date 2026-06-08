import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'

const app = createApp()

describe('api-keys', () => {
  let tenantId: string
  let apiKey: string
  let seedKeyId: string

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

  it('lists API keys without plaintext', async () => {
    const res = await request(app).get('/v1/api-keys').set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      total: 1,
      limit: 50,
      offset: 0,
    })
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({
      prefix: expect.any(String),
    })
    expect(res.body.data[0].api_key).toBeUndefined()
    expect(res.body.data[0]).not.toHaveProperty('api_key')

    seedKeyId = res.body.data[0].id
  })

  it('creates an API key and returns plaintext once', async () => {
    const res = await request(app).post('/v1/api-keys').set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(201)
    expect(res.body.api_key).toMatch(/^whk_[0-9a-f]{32}$/)
    expect(res.body.prefix).toEqual(res.body.api_key.slice(4, 12))
    expect(res.body.id).toEqual(expect.any(String))
    expect(res.body.created_at).toEqual(expect.any(String))
    expect(res.body.revoked_at).toBeNull()
  })

  it('revokes an API key', async () => {
    const createRes = await request(app)
      .post('/v1/api-keys')
      .set('Authorization', `Bearer ${apiKey}`)
    const keyId = createRes.body.id

    const res = await request(app)
      .post(`/v1/api-keys/${keyId}/revoke`)
      .set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: keyId,
      revoked_at: expect.any(String),
    })
    expect(res.body.api_key).toBeUndefined()
  })

  it('rejects revoking an already revoked key', async () => {
    const createRes = await request(app)
      .post('/v1/api-keys')
      .set('Authorization', `Bearer ${apiKey}`)
    const keyId = createRes.body.id

    await request(app).post(`/v1/api-keys/${keyId}/revoke`).set('Authorization', `Bearer ${apiKey}`)

    const res = await request(app)
      .post(`/v1/api-keys/${keyId}/revoke`)
      .set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('already_revoked')
  })

  it('rotates an API key and returns the new plaintext once', async () => {
    const createRes = await request(app)
      .post('/v1/api-keys')
      .set('Authorization', `Bearer ${apiKey}`)

    expect(createRes.status).toBe(201)
    const keyId = createRes.body.id
    const oldRotatedKey = createRes.body.api_key as string

    const res = await request(app)
      .post(`/v1/api-keys/${keyId}/rotate`)
      .set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(201)
    expect(res.body.api_key).toMatch(/^whk_[0-9a-f]{32}$/)
    expect(res.body.id).not.toBe(keyId)

    const newRotatedKey = res.body.api_key as string

    const listRes = await request(app).get('/v1/api-keys').set('Authorization', `Bearer ${apiKey}`)
    const rotated = listRes.body.data.find((row: { id: string }) => row.id === keyId)
    expect(rotated.revoked_at).toEqual(expect.any(String))

    const oldKeyRes = await request(app)
      .get('/v1/stats')
      .set('Authorization', `Bearer ${oldRotatedKey}`)
    expect(oldKeyRes.status).toBe(401)

    const newKeyRes = await request(app)
      .get('/v1/stats')
      .set('Authorization', `Bearer ${newRotatedKey}`)
    expect(newKeyRes.status).toBe(200)
  })

  it('returns 404 for cross-tenant key access', async () => {
    const other = await createTenantWithKey()
    try {
      const res = await request(app)
        .post(`/v1/api-keys/${seedKeyId}/revoke`)
        .set('Authorization', `Bearer ${other.apiKey}`)

      expect(res.status).toBe(404)
    } finally {
      await deleteTenant(other.tenantId)
    }
  })
})
