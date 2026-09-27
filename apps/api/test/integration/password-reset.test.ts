import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { invites } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createUser, deleteUser } from '../helpers/user.js'

const app = createApp()
const OLD_PASSWORD = 'test-password-min-12-chars'
const NEW_PASSWORD = 'replacement-password-12'

describe('admin password reset links', () => {
  let superAdminId: string
  let superAdminEmail: string
  let superAdminPassword: string
  let tenantId: string
  const userIds: string[] = []
  const emails: string[] = []

  beforeAll(async () => {
    const superAdmin = await createUser({ tenantId: null, isSuperAdmin: true })
    superAdminId = superAdmin.userId
    superAdminEmail = superAdmin.email
    superAdminPassword = superAdmin.password
    tenantId = (await createTenantWithKey()).tenantId
  })

  afterAll(async () => {
    const db = getDb()
    for (const email of emails) {
      await db.delete(invites).where(eq(invites.email, email))
    }
    for (const userId of userIds) {
      await deleteUser(userId)
    }
    await deleteTenant(tenantId)
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

  async function addUser(options?: { isSuperAdmin?: boolean; tenantId?: string }) {
    const user = await createUser({
      tenantId: options?.tenantId ?? tenantId,
      isSuperAdmin: options?.isSuperAdmin,
      password: OLD_PASSWORD,
    })
    userIds.push(user.userId)
    emails.push(user.email)
    return user
  }

  it('replaces the password, signs out old sessions, and burns the link', async () => {
    const user = await addUser()
    const admin = await loginSuperAdmin()
    const session = request.agent(app)
    expect(
      (await session.post('/v1/auth/login').send({ email: user.email, password: OLD_PASSWORD }))
        .status,
    ).toBe(200)

    const issued = await admin.post(
      `/v1/admin/tenants/${tenantId}/users/${user.userId}/reset-password`,
    )
    expect(issued.status).toBe(201)
    const token = new URL(issued.body.reset_url).searchParams.get('token')
    expect(token).toEqual(expect.any(String))

    const validated = await request(app).get('/v1/auth/password-reset/validate').query({ token })
    expect(validated.status).toBe(200)
    expect(validated.body.email).toBe(user.email)

    const acceptInvite = await request(app).post('/v1/auth/accept-invite').send({
      token,
      name: 'Should Not Create',
      password: NEW_PASSWORD,
    })
    expect(acceptInvite.status).toBe(400)

    const reset = await request(app).post('/v1/auth/password-reset').send({
      token,
      password: NEW_PASSWORD,
    })
    expect(reset.status).toBe(204)

    expect((await session.get('/v1/auth/me')).status).toBe(401)
    expect(
      (await request(app).post('/v1/auth/login').send({ email: user.email, password: OLD_PASSWORD }))
        .status,
    ).toBe(401)
    expect(
      (await request(app).post('/v1/auth/login').send({ email: user.email, password: NEW_PASSWORD }))
        .status,
    ).toBe(200)
    expect(
      (await request(app).post('/v1/auth/password-reset').send({ token, password: NEW_PASSWORD }))
        .status,
    ).toBe(410)
  })

  it('invalidates the previous unused link when a new one is issued', async () => {
    const user = await addUser()
    const admin = await loginSuperAdmin()
    const first = await admin.post(
      `/v1/admin/tenants/${tenantId}/users/${user.userId}/reset-password`,
    )
    const second = await admin.post(
      `/v1/admin/tenants/${tenantId}/users/${user.userId}/reset-password`,
    )
    const firstToken = new URL(first.body.reset_url).searchParams.get('token')
    const secondToken = new URL(second.body.reset_url).searchParams.get('token')

    expect(
      (await request(app).get('/v1/auth/password-reset/validate').query({ token: firstToken }))
        .status,
    ).toBe(410)
    expect(
      (await request(app).get('/v1/auth/password-reset/validate').query({ token: secondToken }))
        .status,
    ).toBe(200)
  })

  it('resets a super-admin who belongs to the tenant', async () => {
    const user = await addUser({ isSuperAdmin: true })
    const admin = await loginSuperAdmin()
    const issued = await admin.post(
      `/v1/admin/tenants/${tenantId}/users/${user.userId}/reset-password`,
    )
    expect(issued.status).toBe(201)
  })

  it('rejects a short password, a missing user, and a non-admin', async () => {
    const user = await addUser()
    const admin = await loginSuperAdmin()
    const issued = await admin.post(
      `/v1/admin/tenants/${tenantId}/users/${user.userId}/reset-password`,
    )
    const token = new URL(issued.body.reset_url).searchParams.get('token')

    expect(
      (await request(app).post('/v1/auth/password-reset').send({ token, password: 'short' })).status,
    ).toBe(400)
    expect(
      (
        await admin.post(
          `/v1/admin/tenants/${tenantId}/users/${randomUUID()}/reset-password`,
        )
      ).status,
    ).toBe(404)

    const member = request.agent(app)
    expect(
      (await member.post('/v1/auth/login').send({ email: user.email, password: OLD_PASSWORD }))
        .status,
    ).toBe(200)
    expect(
      (await member.post(`/v1/admin/tenants/${tenantId}/users/${user.userId}/reset-password`))
        .status,
    ).toBe(403)

    expect(
      (await request(app).get('/v1/auth/password-reset/validate').query({ token })).status,
    ).toBe(200)
  })

  it('does not treat an invite token as a password reset', async () => {
    const email = `reset-invite-${randomUUID()}@test.com`
    emails.push(email)
    const admin = await loginSuperAdmin()
    const invite = await admin.post('/v1/admin/invites').send({
      kind: 'tenant_user',
      tenant_id: tenantId,
      email,
    })
    expect(invite.status).toBe(201)
    const token = new URL(invite.body.invite_url).searchParams.get('token')
    expect(
      (await request(app).get('/v1/auth/password-reset/validate').query({ token })).status,
    ).toBe(404)
  })
})
