import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { sessions, users } from '@webhook/shared/schema'
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

  it('does not expose direct tenant or user creation and password reset', async () => {
    const agent = await loginSuperAdmin()
    expect((await agent.post('/v1/admin/tenants').send({})).status).toBe(404)
    expect((await agent.post(`/v1/admin/tenants/${existingTenantId}/users`).send({})).status).toBe(
      404,
    )
    expect(
      (
        await agent
          .post(`/v1/admin/tenants/${existingTenantId}/users/${tenantUserId}/reset-password`)
          .send({})
      ).status,
    ).toBe(404)
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
    } finally {
      await getDb().delete(sessions).where(eq(sessions.sid, deletableSessionId))
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
