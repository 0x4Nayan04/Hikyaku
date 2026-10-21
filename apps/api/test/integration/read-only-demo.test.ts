import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { and, count, eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEMO_CREDENTIALS } from '@hikyaku/shared/constants'
import {
  generateApiKey,
  generateInviteToken,
  hashApiKey,
  hashInviteToken,
  prefixOf,
} from '@hikyaku/shared/crypto'
import {
  apiKeys,
  deliveries,
  deliveryOutbox,
  endpoints,
  events,
  invites,
  tenants,
  users,
} from '@hikyaku/shared/schema'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { queue } from '../../src/queue/client.js'
import { createApp } from '../../src/server.js'
import { DEMO_TENANT_ID, seedDemoTenant } from '../../src/scripts/seedDemoTenant.js'
import { createUser, deleteUser } from '../helpers/user.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'

const app = createApp()
const db = getDb()
const validId = randomUUID()
let demo: ReturnType<typeof request.agent>
let admin: ReturnType<typeof request.agent>
let adminId: string
let demoUserId: string
let endpointId: string
let eventId: string
let deliveryId: string
let ordinaryTenantId: string
let ordinaryKey: string
let seeded = false
const oldSeedFlag = process.env.ALLOW_DEMO_SEED

beforeAll(async () => {
  const account = await createUser({ tenantId: null, isSuperAdmin: true })
  adminId = account.userId
  admin = request.agent(app)
  expect((await admin.post('/v1/auth/login').send(account)).status).toBe(200)
  delete process.env.ALLOW_DEMO_SEED
  await expect(seedDemoTenant()).rejects.toThrow('ALLOW_DEMO_SEED=1')
  process.env.ALLOW_DEMO_SEED = '1'
  expect(await seedDemoTenant()).toEqual({ created: true })
  seeded = true
  const [user] = await db.select().from(users).where(eq(users.email, DEMO_CREDENTIALS.email))
  demoUserId = user.id
  const [endpoint] = await db.select().from(endpoints).where(eq(endpoints.tenantId, DEMO_TENANT_ID))
  endpointId = endpoint.id
  const [event] = await db.select().from(events).where(eq(events.tenantId, DEMO_TENANT_ID))
  eventId = event.id
  const [delivery] = await db
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.tenantId, DEMO_TENANT_ID), eq(deliveries.status, 'failed')))
  deliveryId = delivery.id
  const ordinary = await createTenantWithKey()
  ordinaryTenantId = ordinary.tenantId
  ordinaryKey = ordinary.apiKey
  demo = request.agent(app)
  expect((await demo.post('/v1/auth/login').send(DEMO_CREDENTIALS)).status).toBe(200)
})

afterAll(async () => {
  if (oldSeedFlag === undefined) delete process.env.ALLOW_DEMO_SEED
  else process.env.ALLOW_DEMO_SEED = oldSeedFlag
  if (seeded) await deleteTenant(DEMO_TENANT_ID)
  if (ordinaryTenantId) await deleteTenant(ordinaryTenantId)
  if (adminId) await deleteUser(adminId)
  await queue.close()
  await closeRedis()
  await closePool()
})

async function expectReadOnly(response: request.Response) {
  expect(response.status).toBe(403)
  expect(response.body.error.code).toBe('read_only')
}

describe('public read-only demo', () => {
  it('is non-admin, idempotent, synthetic, and has no API keys, open deliveries, or outbox work', async () => {
    expect(await seedDemoTenant()).toEqual({ created: false })
    const me = await demo.get('/v1/auth/me')
    expect(me.body.tenant.read_only).toBe(true)
    expect(me.body.user.is_super_admin).toBe(false)
    expect((await request(app).get('/v1/auth/bootstrap-status')).body.available).toBe(false)
    const [sample] = await db
      .select({ value: count() })
      .from(events)
      .where(eq(events.tenantId, DEMO_TENANT_ID))
    expect(sample.value).toBe(3)
    const [keys] = await db
      .select({ value: count() })
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, DEMO_TENANT_ID))
    const [outbox] = await db
      .select({ value: count() })
      .from(deliveryOutbox)
      .where(eq(deliveryOutbox.tenantId, DEMO_TENANT_ID))
    const [open] = await db
      .select({ value: count() })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.tenantId, DEMO_TENANT_ID),
          inArray(deliveries.status, ['pending', 'in_progress']),
        ),
      )
    expect([keys.value, outbox.value, open.value]).toEqual([0, 0, 0])
  })

  it('permits reading lists, payloads, statistics, and attempt history', async () => {
    for (const path of [
      '/v1/stats',
      '/v1/endpoints',
      '/v1/events',
      `/v1/events/${eventId}`,
      '/v1/deliveries',
      `/v1/deliveries/${deliveryId}`,
      '/v1/api-keys',
    ]) {
      expect((await demo.get(path)).status, path).toBe(200)
    }
    expect((await demo.get(`/v1/deliveries/${deliveryId}`)).body.attempts.length).toBe(5)
  })

  it('blocks all demo-session mutations, including public auth routes', async () => {
    const operations = [
      ['post', '/v1/events'],
      ['post', '/v1/endpoints'],
      ['patch', `/v1/endpoints/${endpointId}`],
      ['post', `/v1/endpoints/${endpointId}/rotate`],
      ['post', `/v1/deliveries/${deliveryId}/replay`],
      ['post', '/v1/api-keys'],
      ['post', `/v1/api-keys/${validId}/rotate`],
      ['post', `/v1/api-keys/${validId}/revoke`],
      ['post', '/v1/auth/change-password'],
      ['post', '/v1/auth/workspace'],
      ['post', '/v1/auth/bootstrap'],
      ['post', '/v1/auth/accept-invite'],
      ['post', '/v1/auth/password-reset'],
      ['post', '/v1/admin/invites'],
      ['patch', `/v1/admin/tenants/${DEMO_TENANT_ID}`],
      ['delete', `/v1/admin/tenants/${DEMO_TENANT_ID}`],
      ['delete', `/v1/admin/tenants/${DEMO_TENANT_ID}/users/${demoUserId}`],
      ['post', `/v1/admin/tenants/${DEMO_TENANT_ID}/users/${demoUserId}/reset-password`],
    ] as const
    for (const [method, path] of operations) await expectReadOnly(await demo[method](path).send({}))
    expect((await demo.post('/v1/auth/logout')).status).toBe(204)
    expect((await demo.post('/v1/auth/login').send(DEMO_CREDENTIALS)).status).toBe(200)
  })

  it('rejects Bearer ingest even if a demo key exists, before touching last_used_at', async () => {
    const key = generateApiKey()
    const [created] = await db
      .insert(apiKeys)
      .values({ tenantId: DEMO_TENANT_ID, keyHash: hashApiKey(key), prefix: prefixOf(key) })
      .returning()
    try {
      await expectReadOnly(
        await request(app)
          .post('/v1/events')
          .set('Authorization', `Bearer ${key}`)
          .send({ idempotency_key: 'blocked', type: 'test', payload: {} }),
      )
      const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, created.id))
      expect(row.lastUsedAt).toBeNull()
    } finally {
      await db.delete(apiKeys).where(eq(apiKeys.id, created.id))
    }
  })

  it('protects demo targets from super-admin edits, invites, resets, and deletes', async () => {
    const routes = [
      () => admin.patch(`/v1/admin/tenants/${DEMO_TENANT_ID}`).send({ tenant_name: 'changed' }),
      () => admin.delete(`/v1/admin/tenants/${DEMO_TENANT_ID}`),
      () => admin.delete(`/v1/admin/tenants/${DEMO_TENANT_ID}/users/${demoUserId}`),
      () => admin.post(`/v1/admin/tenants/${DEMO_TENANT_ID}/users/${demoUserId}/reset-password`),
      () =>
        admin
          .post('/v1/admin/invites')
          .send({ kind: 'tenant_user', tenant_id: DEMO_TENANT_ID, email: 'blocked@example.com' }),
    ]
    for (const route of routes) await expectReadOnly(await route())
  })

  it('rejects pre-existing invite/reset tokens without consuming them or changing the password', async () => {
    for (const kind of ['tenant_user', 'password_reset']) {
      const token = generateInviteToken()
      const [invite] = await db
        .insert(invites)
        .values({
          tenantId: DEMO_TENANT_ID,
          kind,
          email: kind === 'password_reset' ? DEMO_CREDENTIALS.email : 'blocked@example.com',
          tokenHash: hashInviteToken(token),
          expiresAt: new Date(Date.now() + 60_000),
        })
        .returning()
      try {
        await expectReadOnly(
          await request(app)
            .post(kind === 'password_reset' ? '/v1/auth/password-reset' : '/v1/auth/accept-invite')
            .send({ token, name: 'Blocked', password: 'changed-password-123' }),
        )
        const [row] = await db.select().from(invites).where(eq(invites.id, invite.id))
        expect(row.acceptedAt).toBeNull()
      } finally {
        await db.delete(invites).where(eq(invites.id, invite.id))
      }
    }
    expect((await demo.post('/v1/auth/login').send(DEMO_CREDENTIALS)).status).toBe(200)
  })

  it('preserves ordinary writes and tenant isolation; never overwrites an existing writable workspace', async () => {
    const me = await (await import('../helpers/user.js')).createTenantSession(app, ordinaryTenantId)
    expect((await me.get('/v1/auth/me')).body.tenant.read_only).toBe(false)
    expect((await me.post('/v1/api-keys')).status).toBe(201)
    expect(
      (
        await me
          .post('/v1/events')
          .send({ idempotency_key: 'ordinary-cookie', type: 'test', payload: {} })
      ).status,
    ).toBe(202)
    expect(
      (
        await request(app)
          .post('/v1/events')
          .set('Authorization', `Bearer ${ordinaryKey}`)
          .send({ idempotency_key: 'ordinary-bearer', type: 'test', payload: {} })
      ).status,
    ).toBe(202)
    expect((await me.get(`/v1/events/${eventId}`)).status).toBe(404)
    const [ordinaryEvent] = await db
      .select()
      .from(events)
      .where(eq(events.tenantId, ordinaryTenantId))
    expect((await demo.get(`/v1/events/${ordinaryEvent.id}`)).status).toBe(404)
    await db.update(tenants).set({ readOnly: false }).where(eq(tenants.id, DEMO_TENANT_ID))
    try {
      await expect(seedDemoTenant()).rejects.toThrow('refusing to overwrite')
    } finally {
      await db.update(tenants).set({ readOnly: true }).where(eq(tenants.id, DEMO_TENANT_ID))
    }
  })
})
