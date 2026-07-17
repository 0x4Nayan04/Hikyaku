import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { and, eq, isNull } from 'drizzle-orm'
import { auditLog, invites, users } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createUser, deleteUser } from '../helpers/user.js'

const app = createApp()

describe('platform operator management', () => {
  let superAdminId: string
  let superAdminEmail: string
  let superAdminPassword: string
  let tenantId: string

  beforeAll(async () => {
    const superAdmin = await createUser({
      tenantId: null,
      isSuperAdmin: true,
      email: `op-admin-${randomUUID()}@test.com`,
    })
    superAdminId = superAdmin.userId
    superAdminEmail = superAdmin.email
    superAdminPassword = superAdmin.password

    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
  })

  afterAll(async () => {
    await deleteTenant(tenantId)
    await deleteUser(superAdminId)
    await closePool()
    await closeRedis()
  })

  async function loginAs(email: string, password: string) {
    const agent = request.agent(app)
    const loginRes = await agent.post('/v1/auth/login').send({ email, password })
    expect(loginRes.status).toBe(200)
    return agent
  }

  it('returns 403 for a tenant user', async () => {
    const tenantUser = await createUser({ tenantId })
    try {
      const agent = await loginAs(tenantUser.email, tenantUser.password)
      const res = await agent.get('/v1/admin/operators')
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('forbidden')
    } finally {
      await deleteUser(tenantUser.userId)
    }
  })

  it('lists platform operators and excludes tenant users', async () => {
    const tenantUser = await createUser({ tenantId, email: `tenant-op-${randomUUID()}@test.com` })
    try {
      const agent = await loginAs(superAdminEmail, superAdminPassword)
      const res = await agent.get('/v1/admin/operators')
      expect(res.status).toBe(200)
      expect(res.body.total).toBeGreaterThanOrEqual(1)
      expect(res.body.data.some((row: { id: string }) => row.id === superAdminId)).toBe(true)
      expect(res.body.data.some((row: { id: string }) => row.id === tenantUser.userId)).toBe(false)
    } finally {
      await deleteUser(tenantUser.userId)
    }
  })

  it('invites and accepts a platform admin', async () => {
    const email = `new-op-${randomUUID()}@test.com`
    const agent = await loginAs(superAdminEmail, superAdminPassword)

    const inviteRes = await agent
      .post('/v1/admin/operators/invites')
      .send({ email, name: 'New Operator' })
    expect(inviteRes.status).toBe(201)
    expect(inviteRes.body.invite_url).toMatch(/\/accept-invite\?token=/)

    const token = new URL(inviteRes.body.invite_url).searchParams.get('token')
    expect(token).toBeTruthy()

    const db = getDb()
    const audits = await db
      .select({ action: auditLog.action, metadata: auditLog.metadata, tenantId: auditLog.tenantId })
      .from(auditLog)
      .where(and(eq(auditLog.action, 'operator.invited'), eq(auditLog.actorId, superAdminId)))
    expect(
      audits.some(
        (row) =>
          row.tenantId === null && (row.metadata as { email?: string } | null)?.email === email,
      ),
    ).toBe(true)

    const acceptRes = await request(app)
      .post('/v1/auth/accept-invite')
      .send({ token, name: 'New Operator', password: 'operator-password-12' })
    expect(acceptRes.status).toBe(201)
    expect(acceptRes.body.user).toMatchObject({
      email,
      is_super_admin: true,
    })

    const [created] = await db
      .select({
        id: users.id,
        tenantId: users.tenantId,
        isSuperAdmin: users.isSuperAdmin,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    expect(created).toMatchObject({
      tenantId: null,
      isSuperAdmin: true,
    })

    await deleteUser(created.id)
    await db.delete(invites).where(eq(invites.email, email))
  })

  it('rejects deleting self and removes another operator with audit', async () => {
    const other = await createUser({
      tenantId: null,
      isSuperAdmin: true,
      email: `other-op-${randomUUID()}@test.com`,
    })
    const agent = await loginAs(superAdminEmail, superAdminPassword)
    const inviteEmail = `kept-invite-${randomUUID()}@test.com`

    try {
      const selfRes = await agent.delete(`/v1/admin/operators/${superAdminId}`)
      expect(selfRes.status).toBe(409)
      expect(selfRes.body.error.code).toBe('cannot_delete_self')

      // Invites created by the deleted operator must survive (created_by → SET NULL).
      const otherAgent = await loginAs(other.email, other.password)
      const createInviteRes = await otherAgent
        .post('/v1/admin/operators/invites')
        .send({ email: inviteEmail, name: 'Kept' })
      expect(createInviteRes.status).toBe(201)

      const deleteRes = await agent.delete(`/v1/admin/operators/${other.userId}`)
      expect(deleteRes.status).toBe(204)

      const [deleted] = await getDb()
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, other.userId))
        .limit(1)
      expect(deleted).toBeUndefined()

      const [keptInvite] = await getDb()
        .select({ email: invites.email, createdByUserId: invites.createdByUserId })
        .from(invites)
        .where(eq(invites.email, inviteEmail))
        .limit(1)
      expect(keptInvite).toMatchObject({ email: inviteEmail, createdByUserId: null })

      const audits = await getDb()
        .select({ metadata: auditLog.metadata, tenantId: auditLog.tenantId })
        .from(auditLog)
        .where(and(eq(auditLog.action, 'operator.removed'), isNull(auditLog.tenantId)))
      expect(
        audits.some(
          (row) =>
            row.tenantId === null &&
            (row.metadata as { email?: string } | null)?.email === other.email,
        ),
      ).toBe(true)

      const auditListRes = await agent
        .get('/v1/admin/audit-log')
        .query({ action: 'operator.removed', limit: 5 })
      expect(auditListRes.status).toBe(200)
      expect(
        auditListRes.body.data.some(
          (row: { actor_email: string | null; metadata: { email?: string } | null }) =>
            row.actor_email === superAdminEmail && row.metadata?.email === other.email,
        ),
      ).toBe(true)
    } finally {
      await getDb().delete(invites).where(eq(invites.email, inviteEmail))
      await deleteUser(other.userId).catch(() => undefined)
    }
  })


  it('rejects deleting the last platform operator', async () => {
    const db = getDb()
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isSuperAdmin, true), isNull(users.tenantId)))
    const demoted = existing.filter((row) => row.id !== superAdminId)

    for (const row of demoted) {
      await db.update(users).set({ isSuperAdmin: false }).where(eq(users.id, row.id))
    }

    const tenantBound = await createUser({
      tenantId,
      isSuperAdmin: true,
      email: `bound-op-${randomUUID()}@test.com`,
    })

    try {
      const boundAgent = await loginAs(tenantBound.email, tenantBound.password)
      const lastRes = await boundAgent.delete(`/v1/admin/operators/${superAdminId}`)
      expect(lastRes.status).toBe(409)
      expect(lastRes.body.error.code).toBe('last_operator')
    } finally {
      await deleteUser(tenantBound.userId)
      for (const row of demoted) {
        await db.update(users).set({ isSuperAdmin: true }).where(eq(users.id, row.id))
      }
    }
  })
})
