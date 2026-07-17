import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { and, eq, isNull } from 'drizzle-orm'
import { auditLog, tenants, users } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createUser, deleteUser } from '../helpers/user.js'

const app = createApp()

describe('super-admin tenant management', () => {
  let superAdminId: string
  let superAdminEmail: string
  let superAdminPassword: string
  let tenantUserId: string
  let existingTenantId: string

  beforeAll(async () => {
    const superAdmin = await createUser({
      tenantId: null,
      isSuperAdmin: true,
      email: `super-${randomUUID()}@test.com`,
    })
    superAdminId = superAdmin.userId
    superAdminEmail = superAdmin.email
    superAdminPassword = superAdmin.password

    const tenant = await createTenantWithKey()
    existingTenantId = tenant.tenantId

    const tenantUser = await createUser({ tenantId: existingTenantId })
    tenantUserId = tenantUser.userId
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
    const loginRes = await agent
      .post('/v1/auth/login')
      .send({ email: superAdminEmail, password: superAdminPassword })
    expect(loginRes.status).toBe(200)
    return agent
  }

  it('returns 403 for a tenant user', async () => {
    const tenantUser = await createUser({ tenantId: existingTenantId })
    const agent = request.agent(app)

    try {
      const loginRes = await agent
        .post('/v1/auth/login')
        .send({ email: tenantUser.email, password: tenantUser.password })
      expect(loginRes.status).toBe(200)

      const res = await agent.get('/v1/admin/tenants')
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('forbidden')
    } finally {
      await deleteUser(tenantUser.userId)
    }
  })

  it('lists tenants for a super-admin session', async () => {
    const agent = await loginSuperAdmin()

    const res = await agent.get('/v1/admin/tenants')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      total: expect.any(Number),
      limit: 50,
      offset: 0,
    })
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      status: 'active',
      created_at: expect.any(String),
    })
  })

  it('searches tenants by full ID and ID prefix on the server', async () => {
    const agent = await loginSuperAdmin()
    const [tenant] = await getDb()
      .insert(tenants)
      .values({ name: `Search-${randomUUID()}` })
      .returning({ id: tenants.id })

    try {
      const fullIdRes = await agent
        .get('/v1/admin/tenants')
        .query({ search: tenant.id, limit: 1, offset: 0 })
      expect(fullIdRes.status).toBe(200)
      expect(fullIdRes.body.total).toBe(1)
      expect(fullIdRes.body.data).toHaveLength(1)
      expect(fullIdRes.body.data[0].id).toBe(tenant.id)

      const prefixRes = await agent
        .get('/v1/admin/tenants')
        .query({ search: tenant.id.slice(0, 8), limit: 1, offset: 0 })
      expect(prefixRes.status).toBe(200)
      expect(prefixRes.body.data.some((row: { id: string }) => row.id === tenant.id)).toBe(true)
    } finally {
      await deleteTenant(tenant.id)
    }
  })

  it('creates a tenant and owner user', async () => {
    const agent = await loginSuperAdmin()
    const tenantName = `Acme-${randomUUID().slice(0, 8)}`
    const ownerEmail = `owner-${randomUUID()}@test.com`

    const res = await agent.post('/v1/admin/tenants').send({
      tenant_name: tenantName,
      owner_email: ownerEmail,
      owner_password: 'temporary-password-12',
      owner_name: 'Acme Owner',
    })

    expect(res.status).toBe(201)
    expect(res.body.tenant).toMatchObject({
      name: tenantName,
    })
    expect(res.body.tenant.created_at).toEqual(expect.any(String))
    expect(res.body.user).toMatchObject({
      email: ownerEmail,
      name: 'Acme Owner',
      is_super_admin: false,
    })
    expect(res.body.api_key).toBeUndefined()

    const db = getDb()
    await db.delete(users).where(eq(users.email, ownerEmail))
    await db.delete(tenants).where(eq(tenants.id, res.body.tenant.id))
  })

  it('creates an additional user for a tenant', async () => {
    const agent = await loginSuperAdmin()
    const email = `member-${randomUUID()}@test.com`

    const res = await agent.post(`/v1/admin/tenants/${existingTenantId}/users`).send({
      email,
      password: 'temporary-password-12',
      name: 'Team Member',
    })

    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({
      email,
      name: 'Team Member',
      is_super_admin: false,
    })

    await deleteUser(res.body.user.id)
  })

  it('returns 404 when creating a user for a missing tenant', async () => {
    const agent = await loginSuperAdmin()

    const res = await agent
      .post('/v1/admin/tenants/880e8400-e29b-41d4-a716-446655440099/users')
      .send({
        email: `missing-${randomUUID()}@test.com`,
        password: 'temporary-password-12',
        name: 'Missing Tenant User',
      })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('not_found')
  })

  it('resets a tenant user password and audits the action', async () => {
    const agent = await loginSuperAdmin()
    const tenantUser = await createUser({
      tenantId: existingTenantId,
      email: `reset-${randomUUID()}@test.com`,
    })
    const newPassword = 'replacement-password-12'

    try {
      const resetRes = await agent
        .post(`/v1/admin/tenants/${existingTenantId}/users/${tenantUser.userId}/reset-password`)
        .send({ password: newPassword })
      expect(resetRes.status).toBe(204)

      expect(
        (
          await request(app)
            .post('/v1/auth/login')
            .send({ email: tenantUser.email, password: tenantUser.password })
        ).status,
      ).toBe(401)
      expect(
        (
          await request(app)
            .post('/v1/auth/login')
            .send({ email: tenantUser.email, password: newPassword })
        ).status,
      ).toBe(200)

      const [audit] = await getDb()
        .select({ metadata: auditLog.metadata })
        .from(auditLog)
        .where(
          and(eq(auditLog.action, 'user.password_reset'), eq(auditLog.tenantId, existingTenantId)),
        )
        .limit(1)
      expect(audit?.metadata).toMatchObject({ email: tenantUser.email })
    } finally {
      await deleteUser(tenantUser.userId)
    }
  })

  it('deletes a tenant user but protects self and the last tenant user', async () => {
    const agent = await loginSuperAdmin()
    const deletable = await createUser({
      tenantId: existingTenantId,
      email: `delete-${randomUUID()}@test.com`,
    })
    const singleUserTenant = await createTenantWithKey()
    const lastUser = await createUser({ tenantId: singleUserTenant.tenantId })

    try {
      const selfRes = await agent.delete(
        `/v1/admin/tenants/${existingTenantId}/users/${superAdminId}`,
      )
      expect(selfRes.status).toBe(409)
      expect(selfRes.body.error.code).toBe('cannot_delete_self')

      const lastUserRes = await agent.delete(
        `/v1/admin/tenants/${singleUserTenant.tenantId}/users/${lastUser.userId}`,
      )
      expect(lastUserRes.status).toBe(409)
      expect(lastUserRes.body.error.code).toBe('last_tenant_user')

      const deleteRes = await agent.delete(
        `/v1/admin/tenants/${existingTenantId}/users/${deletable.userId}`,
      )
      expect(deleteRes.status).toBe(204)

      const [deleted] = await getDb()
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, deletable.userId))
        .limit(1)
      expect(deleted).toBeUndefined()

      const [audit] = await getDb()
        .select({ metadata: auditLog.metadata })
        .from(auditLog)
        .where(and(eq(auditLog.action, 'user.deleted'), eq(auditLog.tenantId, existingTenantId)))
        .limit(1)
      expect(audit?.metadata).toMatchObject({ email: deletable.email })
    } finally {
      await deleteUser(deletable.userId)
      await deleteUser(lastUser.userId)
      await deleteTenant(singleUserTenant.tenantId)
    }
  })

  it('retains audit_log rows after tenant delete', async () => {
    const agent = await loginSuperAdmin()
    const tenantName = `AuditKeep-${randomUUID().slice(0, 8)}`
    const renamedName = `${tenantName}-renamed`
    const ownerEmail = `audit-owner-${randomUUID()}@test.com`

    const createRes = await agent.post('/v1/admin/tenants').send({
      tenant_name: tenantName,
      owner_email: ownerEmail,
      owner_password: 'temporary-password-12',
      owner_name: 'Audit Owner',
    })
    expect(createRes.status).toBe(201)
    const tenantId = createRes.body.tenant.id as string
    const ownerId = createRes.body.user.id as string

    const renameRes = await agent
      .patch(`/v1/admin/tenants/${tenantId}`)
      .send({ tenant_name: renamedName })
    expect(renameRes.status).toBe(200)

    const deleteRes = await agent.delete(`/v1/admin/tenants/${tenantId}`)
    expect(deleteRes.status).toBe(204)

    const db = getDb()
    const rows = await db
      .select({
        action: auditLog.action,
        tenantId: auditLog.tenantId,
        metadata: auditLog.metadata,
      })
      .from(auditLog)
      .where(and(eq(auditLog.actorId, superAdminId), isNull(auditLog.tenantId)))

    const created = rows.find(
      (r) =>
        r.action === 'tenant.created' &&
        (r.metadata as { ownerEmail?: string } | null)?.ownerEmail === ownerEmail,
    )
    const renamed = rows.find(
      (r) =>
        r.action === 'tenant.renamed' &&
        (r.metadata as { newName?: string } | null)?.newName === renamedName,
    )
    const deleted = rows.find(
      (r) =>
        r.action === 'tenant.deleted' &&
        (r.metadata as { tenantId?: string } | null)?.tenantId === tenantId,
    )

    expect(created?.metadata).toMatchObject({ tenantName, ownerEmail })
    expect(renamed?.metadata).toMatchObject({ oldName: tenantName, newName: renamedName })
    expect(deleted?.metadata).toMatchObject({ tenantId, tenantName: renamedName })

    // Clean leftover owner (cascade may already have removed them with the tenant).
    await db.delete(users).where(eq(users.id, ownerId))
  })

  it('suspends tenant session and API-key access until reactivated', async () => {
    const agent = await loginSuperAdmin()
    const tenant = await createTenantWithKey()
    const tenantUser = await createUser({
      tenantId: tenant.tenantId,
      email: `suspended-${randomUUID()}@test.com`,
    })
    const tenantAgent = request.agent(app)

    try {
      const loginRes = await tenantAgent
        .post('/v1/auth/login')
        .send({ email: tenantUser.email, password: tenantUser.password })
      expect(loginRes.status).toBe(200)

      const suspendRes = await agent.post(`/v1/admin/tenants/${tenant.tenantId}/suspend`)
      expect(suspendRes.status).toBe(200)
      expect(suspendRes.body.status).toBe('suspended')

      for (const res of [
        await tenantAgent.get('/v1/stats'),
        await request(app).get('/v1/stats').set('Authorization', `Bearer ${tenant.apiKey}`),
      ]) {
        expect(res.status).toBe(403)
        expect(res.body.error).toEqual({
          code: 'tenant_suspended',
          message: 'Tenant is suspended',
        })
      }

      const unsuspendRes = await agent.post(`/v1/admin/tenants/${tenant.tenantId}/unsuspend`)
      expect(unsuspendRes.status).toBe(200)
      expect(unsuspendRes.body.status).toBe('active')

      expect((await tenantAgent.get('/v1/stats')).status).toBe(200)
      expect(
        (await request(app).get('/v1/stats').set('Authorization', `Bearer ${tenant.apiKey}`))
          .status,
      ).toBe(200)

      const actions = await getDb()
        .select({ action: auditLog.action })
        .from(auditLog)
        .where(eq(auditLog.tenantId, tenant.tenantId))
      expect(actions.map(({ action }) => action)).toEqual(
        expect.arrayContaining(['tenant.suspended', 'tenant.unsuspended']),
      )
    } finally {
      await deleteUser(tenantUser.userId)
      await deleteTenant(tenant.tenantId)
    }
  })
})
