import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { eq, inArray } from 'drizzle-orm'
import { invites, sessions, tenants, users } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createUser, deleteUser } from '../helpers/user.js'

const app = createApp()

describe('minimal super-admin tenant management', () => {
  let superAdminId: string
  let superAdminEmail: string
  let superAdminPassword: string
  let existingTenantId: string
  let tenantUserId: string

  beforeAll(async () => {
    const superAdmin = await createUser({ tenantId: null, isSuperAdmin: true })
    superAdminId = superAdmin.userId
    superAdminEmail = superAdmin.email
    superAdminPassword = superAdmin.password
    existingTenantId = (await createTenantWithKey()).tenantId
    tenantUserId = (await createUser({ tenantId: existingTenantId })).userId
  })

  afterAll(async () => {
    await deleteUser(tenantUserId)
    await deleteTenant(existingTenantId)
    await deleteUser(superAdminId)
    await closePool()
    await closeRedis()
  })

  async function loginSuperAdmin() {
    const agent = request.agent(app)
    const response = await agent
      .post('/v1/auth/login')
      .send({ email: superAdminEmail, password: superAdminPassword })
    expect(response.status).toBe(200)
    return agent
  }

  it('lists and searches tenants', async () => {
    const agent = await loginSuperAdmin()
    const listResponse = await agent.get('/v1/admin/tenants')
    expect(listResponse.status).toBe(200)
    expect(listResponse.body.data[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      created_at: expect.any(String),
    })
    expect(listResponse.body.data[0]).not.toHaveProperty('status')

    const searchResponse = await agent
      .get('/v1/admin/tenants')
      .query({ search: existingTenantId.slice(0, 8) })
    expect(searchResponse.status).toBe(200)
    expect(
      searchResponse.body.data.some((row: { id: string }) => row.id === existingTenantId),
    ).toBe(true)
  })

  it('matches dashed and dashless ids, prefixes, names, and literal wildcards', async () => {
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    const wildcardId = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
    const decoyId = 'cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa'
    const name = 'Acme Catalog qjw'
    const ids = [id, wildcardId, decoyId]
    const db = getDb()
    await db.insert(tenants).values([
      { id, name },
      { id: wildcardId, name: 'Quota 100%_met qjw' },
      { id: decoyId, name: 'Quota 100XXmet qjw' },
    ])

    try {
      const agent = await loginSuperAdmin()
      const idsFor = async (search: string) => {
        const response = await agent.get('/v1/admin/tenants').query({ search })
        expect(response.status).toBe(200)
        return response.body.data.map((row: { id: string }) => row.id) as string[]
      }

      for (const search of [
        id,
        id.toUpperCase(),
        id.replaceAll('-', ''),
        id.replaceAll('-', '').toUpperCase(),
        id.slice(0, 8),
        id.replaceAll('-', '').slice(0, 9),
        id.slice(0, 13),
      ]) {
        expect(await idsFor(search)).toContain(id)
      }

      expect(await idsFor('01234567')).not.toContain(id)
      expect(await idsFor(name)).toEqual([id])

      const wildcard = await idsFor('100%_')
      expect(wildcard).toContain(wildcardId)
      expect(wildcard).not.toContain(decoyId)

      for (const search of ['%', '_']) {
        const matches = await idsFor(search)
        expect(matches).toContain(wildcardId)
        expect(matches).not.toContain(decoyId)
      }
    } finally {
      await db.delete(tenants).where(inArray(tenants.id, ids))
    }
  })

  it('orders tenants by creation time, then id', async () => {
    const newer = '20000000-0000-4000-8000-000000000001'
    const high = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3'
    const mid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'
    const low = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
    const ids = [newer, high, mid, low]
    const sameCreatedAt = new Date('2020-01-01T00:00:00.000Z')
    const newerCreatedAt = new Date('2020-01-02T00:00:00.000Z')
    const label = 'tie order label qjw'
    const db = getDb()
    await db.insert(tenants).values(
      ids.map((id) => ({
        id,
        name: `${label} ${id.slice(-1)}`,
        createdAt: id === newer ? newerCreatedAt : sameCreatedAt,
      })),
    )

    try {
      const agent = await loginSuperAdmin()
      const page = async (offset: number) => {
        const response = await agent
          .get('/v1/admin/tenants')
          .query({ search: label, limit: 2, offset })
        expect(response.status).toBe(200)
        return response.body as {
          data: Array<{ id: string; created_at: string }>
          has_more: boolean
        }
      }

      const first = await page(0)
      const second = await page(2)
      const firstIds = first.data.map((row) => row.id)
      const secondIds = second.data.map((row) => row.id)

      expect(firstIds).toEqual([newer, high])
      expect(secondIds).toEqual([mid, low])
      expect(firstIds.filter((rowId) => secondIds.includes(rowId))).toEqual([])
      expect([...firstIds, ...secondIds]).toEqual(ids)
      expect(first.has_more).toBe(true)
      expect(second.has_more).toBe(false)
      expect(first.data[0].created_at).toBe(newerCreatedAt.toISOString())
      expect(first.data[1].created_at).toBe(sameCreatedAt.toISOString())
    } finally {
      await db.delete(tenants).where(inArray(tenants.id, ids))
    }
  })

  it('renames a tenant', async () => {
    const name = `Renamed-${randomUUID().slice(0, 8)}`
    const response = await (
      await loginSuperAdmin()
    )
      .patch(`/v1/admin/tenants/${existingTenantId}`)
      .send({ tenant_name: name })
    expect(response.status).toBe(200)
    expect(response.body.name).toBe(name)
  })

  it('does not expose direct tenant or user creation', async () => {
    const agent = await loginSuperAdmin()
    expect((await agent.post('/v1/admin/tenants').send({})).status).toBe(404)
    expect((await agent.post(`/v1/admin/tenants/${existingTenantId}/users`).send({})).status).toBe(
      404,
    )
  })

  it('deletes a tenant user but protects the last tenant user', async () => {
    const agent = await loginSuperAdmin()
    const deletable = await createUser({ tenantId: existingTenantId })
    const deletableSessionId = `admin-delete-user-${deletable.userId}`
    const singleUserTenant = await createTenantWithKey()
    const lastUser = await createUser({ tenantId: singleUserTenant.tenantId })

    try {
      await getDb()
        .insert(sessions)
        .values({
          sid: deletableSessionId,
          sess: { cookie: {}, userId: deletable.userId },
          expire: new Date(Date.now() + 60_000),
        })

      const protectedResponse = await agent.delete(
        `/v1/admin/tenants/${singleUserTenant.tenantId}/users/${lastUser.userId}`,
      )
      expect(protectedResponse.status).toBe(409)

      const resetResponse = await agent.post(
        `/v1/admin/tenants/${existingTenantId}/users/${deletable.userId}/reset-password`,
      )
      expect(resetResponse.status).toBe(201)
      const resetToken = new URL(resetResponse.body.reset_url).searchParams.get('token')

      const deleteResponse = await agent.delete(
        `/v1/admin/tenants/${existingTenantId}/users/${deletable.userId}`,
      )
      expect(deleteResponse.status).toBe(204)
      const [deleted] = await getDb()
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, deletable.userId))
      expect(deleted).toBeUndefined()

      const revokedSessions = await getDb()
        .select({ sid: sessions.sid })
        .from(sessions)
        .where(eq(sessions.sid, deletableSessionId))
      expect(revokedSessions).toEqual([])

      const replacementInvite = await agent.post('/v1/admin/invites').send({
        kind: 'tenant_user',
        tenant_id: existingTenantId,
        email: deletable.email,
      })
      expect(replacementInvite.status).toBe(201)

      const oldReset = await request(app)
        .get('/v1/auth/password-reset/validate')
        .query({ token: resetToken })
      expect(oldReset.status).toBe(410)
      expect(oldReset.body.error.code).toBe('reset_used')
    } finally {
      await getDb().delete(sessions).where(eq(sessions.sid, deletableSessionId))
      await getDb().delete(invites).where(eq(invites.email, deletable.email))
      await deleteUser(deletable.userId)
      await deleteUser(lastUser.userId)
      await deleteTenant(singleUserTenant.tenantId)
    }
  })

  it('deletes a tenant', async () => {
    const tenant = await createTenantWithKey()
    const user = await createUser({ tenantId: tenant.tenantId })
    const sessionId = `admin-delete-tenant-${user.userId}`

    try {
      await getDb()
        .insert(sessions)
        .values({
          sid: sessionId,
          sess: { cookie: {}, userId: user.userId },
          expire: new Date(Date.now() + 60_000),
        })

      const response = await (
        await loginSuperAdmin()
      ).delete(`/v1/admin/tenants/${tenant.tenantId}`)
      expect(response.status).toBe(204)

      const revokedSessions = await getDb()
        .select({ sid: sessions.sid })
        .from(sessions)
        .where(eq(sessions.sid, sessionId))
      expect(revokedSessions).toEqual([])
    } finally {
      await getDb().delete(sessions).where(eq(sessions.sid, sessionId))
      await deleteUser(user.userId)
      await deleteTenant(tenant.tenantId)
    }
  })
})
