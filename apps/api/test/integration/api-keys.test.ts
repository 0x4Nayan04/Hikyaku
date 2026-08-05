import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createTenantSession } from '../helpers/user.js'

const app = createApp()

describe('api-keys', () => {
  let tenantId: string
  let seedKeyId: string
  let agent: ReturnType<typeof request.agent>

  beforeAll(async () => {
    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    agent = await createTenantSession(app, tenantId)
  })

  afterAll(async () => {
    await deleteTenant(tenantId)
    await closePool()
    await closeRedis()
  })

  it('lists API keys without plaintext', async () => {
    const res = await agent.get('/v1/api-keys')

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
    const res = await agent.post('/v1/api-keys')

    expect(res.status).toBe(201)
    expect(res.body.api_key).toMatch(/^whk_[0-9a-f]{32}$/)
    expect(res.body.prefix).toEqual(res.body.api_key.slice(4, 12))
    expect(res.body.id).toEqual(expect.any(String))
    expect(res.body.created_at).toEqual(expect.any(String))
    expect(res.body.revoked_at).toBeNull()
  })

  it('filters API keys by active or revoked status', async () => {
    const active = await agent.post('/v1/api-keys')
    const revoked = await agent.post('/v1/api-keys')
    await agent.post(`/v1/api-keys/${revoked.body.id}/revoke`)

    const activeRes = await agent.get('/v1/api-keys').query({ status: 'active', limit: 1 })
    expect(activeRes.status).toBe(200)
    expect(activeRes.body.total).toBeGreaterThan(0)
    expect(activeRes.body.data).toHaveLength(1)
    expect(activeRes.body.data[0].revoked_at).toBeNull()

    const revokedRes = await agent.get('/v1/api-keys').query({ status: 'revoked', limit: 1 })
    expect(revokedRes.status).toBe(200)
    expect(revokedRes.body.total).toBeGreaterThan(0)
    expect(revokedRes.body.data).toHaveLength(1)
    expect(revokedRes.body.data[0].revoked_at).toEqual(expect.any(String))

    expect(active.body.revoked_at).toBeNull()
  })

  it('rejects an invalid API key status filter', async () => {
    const res = await agent.get('/v1/api-keys').query({ status: 'unknown' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('validation_error')
  })

  it('revokes an API key', async () => {
    const createRes = await agent.post('/v1/api-keys')
    const keyId = createRes.body.id

    const res = await agent.post(`/v1/api-keys/${keyId}/revoke`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: keyId,
      revoked_at: expect.any(String),
    })
    expect(res.body.api_key).toBeUndefined()
  })

  it('rejects revoking an already revoked key', async () => {
    const createRes = await agent.post('/v1/api-keys')
    const keyId = createRes.body.id

    await agent.post(`/v1/api-keys/${keyId}/revoke`)

    const res = await agent.post(`/v1/api-keys/${keyId}/revoke`)

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('already_revoked')
  })

  it('allows only one concurrent revocation of the same key', async () => {
    const createRes = await agent.post('/v1/api-keys')
    const keyId = createRes.body.id

    const results = await Promise.all([1, 2].map(() => agent.post(`/v1/api-keys/${keyId}/revoke`)))

    expect(results.map((result) => result.status).sort()).toEqual([200, 409])
    expect(results.find((result) => result.status === 409)?.body.error.code).toBe('already_revoked')
  })

  it('rotates an API key and returns the new plaintext once', async () => {
    const createRes = await agent.post('/v1/api-keys')

    expect(createRes.status).toBe(201)
    const keyId = createRes.body.id
    const oldRotatedKey = createRes.body.api_key as string

    const res = await agent.post(`/v1/api-keys/${keyId}/rotate`)

    expect(res.status).toBe(201)
    expect(res.body.api_key).toMatch(/^whk_[0-9a-f]{32}$/)
    expect(res.body.id).not.toBe(keyId)

    const newRotatedKey = res.body.api_key as string

    const listRes = await agent.get('/v1/api-keys')
    const rotated = listRes.body.data.find((row: { id: string }) => row.id === keyId)
    expect(rotated.revoked_at).toEqual(expect.any(String))

    const oldKeyRes = await request(app)
      .get('/v1/stats')
      .set('Authorization', `Bearer ${oldRotatedKey}`)
    expect(oldKeyRes.status).toBe(401)

    const newKeyRes = await request(app)
      .get('/v1/stats')
      .set('Authorization', `Bearer ${newRotatedKey}`)
    expect(newKeyRes.status).toBe(401)

    const eventRes = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${newRotatedKey}`)
      .send({ idempotency_key: 'rotated-key-event', type: 'test', payload: {} })
    expect(eventRes.status).toBe(202)
  })

  it('allows only one concurrent rotation of the same key', async () => {
    const createRes = await agent.post('/v1/api-keys')
    const keyId = createRes.body.id

    const results = await Promise.all([1, 2].map(() => agent.post(`/v1/api-keys/${keyId}/rotate`)))

    expect(results.map((result) => result.status).sort()).toEqual([201, 409])
    expect(results.find((result) => result.status === 409)?.body.error.code).toBe('already_revoked')
  })

  it('returns 404 for cross-tenant key access', async () => {
    const other = await createTenantWithKey()
    try {
      const otherAgent = await createTenantSession(app, other.tenantId)
      const res = await otherAgent.post(`/v1/api-keys/${seedKeyId}/revoke`)

      expect(res.status).toBe(404)
    } finally {
      await deleteTenant(other.tenantId)
    }
  })
})
