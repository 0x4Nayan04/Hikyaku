import request from 'supertest'
import { eq } from 'drizzle-orm'
import { apiKeys, deliveries, endpoints, events, users } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createTenantSession, createUser, deleteUser } from '../helpers/user.js'

const app = createApp()

describe('list endpoint pagination', () => {
  let tenantId: string
  let apiKey: string
  let agent: ReturnType<typeof request.agent>

  beforeAll(async () => {
    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    apiKey = tenant.apiKey
    agent = await createTenantSession(app, tenantId)

    const db = getDb()
    await db.insert(endpoints).values(
      Array.from({ length: 3 }, (_, index) => ({
        tenantId,
        url: `https://webhook.site/page-${index}`,
        secret: 'whsec_' + 'b'.repeat(32),
      })),
    )
  })

  afterAll(async () => {
    await deleteTenant(tenantId)
    await closePool()
    await closeRedis()
  })

  it('paginates GET /v1/endpoints', async () => {
    const res = await agent.get('/v1/endpoints?limit=2&offset=1')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      has_more: false,
      limit: 2,
      offset: 1,
    })
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data.every((row: { secret?: string }) => row.secret === undefined)).toBe(true)
  })

  it('paginates GET /v1/events', async () => {
    for (const key of ['evt-a', 'evt-b', 'evt-c']) {
      const ingest = await request(app)
        .post('/v1/events')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ idempotency_key: key, type: 'test', payload: {} })

      expect(ingest.status).toBe(202)
    }

    const res = await agent.get('/v1/events?limit=1&offset=2')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      has_more: false,
      limit: 1,
      offset: 2,
    })
    expect(res.body.data).toHaveLength(1)
  })

  it('paginates GET /v1/deliveries', async () => {
    const res = await agent.get('/v1/deliveries?limit=2&offset=0')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      has_more: true,
      limit: 2,
      offset: 0,
    })
    expect(res.body.data).toHaveLength(2)
  })

  it('breaks timestamp ties by id on events, deliveries, endpoints, and API keys', async () => {
    const newer = '10000000-0000-4000-8000-000000000001'
    const high = 'ffffffff-ffff-4fff-8fff-fffffffffff3'
    const mid = 'ffffffff-ffff-4fff-8fff-fffffffffff2'
    const low = 'ffffffff-ffff-4fff-8fff-fffffffffff1'
    const ids = [newer, high, mid, low]
    const sameCreatedAt = new Date('2020-01-01T00:00:00.000Z')
    const newerCreatedAt = new Date('2020-01-02T00:00:00.000Z')
    const createdAtFor = (id: string) => (id === newer ? newerCreatedAt : sameCreatedAt)
    const tieTenant = await createTenantWithKey()
    const tieAgent = await createTenantSession(app, tieTenant.tenantId)
    const db = getDb()

    try {
      await db.delete(apiKeys).where(eq(apiKeys.tenantId, tieTenant.tenantId))
      await db.insert(endpoints).values(
        ids.map((id) => ({
          id,
          tenantId: tieTenant.tenantId,
          url: `https://example.com/tie/${id}`,
          secret: 'whsec_' + 'b'.repeat(32),
          createdAt: createdAtFor(id),
        })),
      )
      await db.insert(events).values(
        ids.map((id) => ({
          id,
          tenantId: tieTenant.tenantId,
          idempotencyKey: `tie-${id}`,
          type: 'test',
          payload: {},
          createdAt: createdAtFor(id),
        })),
      )
      await db.insert(deliveries).values(
        ids.map((id) => ({
          id,
          tenantId: tieTenant.tenantId,
          eventId: id,
          endpointId: low,
          createdAt: createdAtFor(id),
        })),
      )
      await db.insert(apiKeys).values(
        ids.map((id) => ({
          id,
          tenantId: tieTenant.tenantId,
          keyHash: `tie-hash-${id}`,
          prefix: 'tiebreak',
          createdAt: createdAtFor(id),
        })),
      )

      for (const path of ['/v1/events', '/v1/deliveries', '/v1/endpoints', '/v1/api-keys']) {
        const first = await tieAgent.get(path).query({ limit: 2, offset: 0 })
        const second = await tieAgent.get(path).query({ limit: 2, offset: 2 })
        expect(first.status).toBe(200)
        expect(second.status).toBe(200)
        const firstIds = first.body.data.map((row: { id: string }) => row.id)
        const secondIds = second.body.data.map((row: { id: string }) => row.id)
        expect(firstIds).toEqual([newer, high])
        expect(secondIds).toEqual([mid, low])
        expect(firstIds.filter((rowId: string) => secondIds.includes(rowId))).toEqual([])
        expect([...firstIds, ...secondIds]).toEqual(ids)
        expect(first.body.has_more).toBe(true)
        expect(second.body.has_more).toBe(false)
        expect(first.body.data[0].created_at).toBe(newerCreatedAt.toISOString())
        expect(first.body.data[1].created_at).toBe(sameCreatedAt.toISOString())
      }
    } finally {
      await deleteTenant(tieTenant.tenantId)
    }
  })

  it('breaks timestamp ties by id on admin tenant users', async () => {
    const newer = '10000000-0000-4000-8000-000000000011'
    const high = 'ffffffff-ffff-4fff-8fff-fffffffffff6'
    const mid = 'ffffffff-ffff-4fff-8fff-fffffffffff5'
    const low = 'ffffffff-ffff-4fff-8fff-fffffffffff4'
    const ids = [newer, high, mid, low]
    const sameCreatedAt = new Date('2020-01-01T00:00:00.000Z')
    const tieTenant = await createTenantWithKey()
    const superAdmin = await createUser({ tenantId: null, isSuperAdmin: true })
    const db = getDb()

    try {
      await db.insert(users).values(
        ids.map((id) => ({
          id,
          tenantId: tieTenant.tenantId,
          email: `tie-${id}@test.com`,
          passwordHash: 'unused',
          name: 'Tie User',
          createdAt: id === newer ? new Date('2020-01-02T00:00:00.000Z') : sameCreatedAt,
        })),
      )
      const superAgent = request.agent(app)
      const login = await superAgent
        .post('/v1/auth/login')
        .send({ email: superAdmin.email, password: superAdmin.password })
      expect(login.status).toBe(200)

      const path = `/v1/admin/tenants/${tieTenant.tenantId}/users`
      const first = await superAgent.get(path).query({ limit: 2, offset: 0 })
      const second = await superAgent.get(path).query({ limit: 2, offset: 2 })
      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      const pagedIds = [...first.body.data, ...second.body.data].map((row: { id: string }) => row.id)
      expect(pagedIds).toEqual(ids)
    } finally {
      await deleteTenant(tieTenant.tenantId)
      await deleteUser(superAdmin.userId)
    }
  })
})
