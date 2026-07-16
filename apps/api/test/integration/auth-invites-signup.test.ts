import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { hashPassword } from '@webhook/shared/password'
import { invites, signupRequests, users } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createUser, deleteUser } from '../helpers/user.js'

const app = createApp()
const PASSWORD = 'test-password-min-12-chars'

describe('invites and signup requests', () => {
  let superAdminId: string
  let superAdminEmail: string
  let superAdminPassword: string
  let existingTenantId: string
  const cleanupEmails: string[] = []

  beforeAll(async () => {
    const superAdmin = await createUser({
      tenantId: null,
      isSuperAdmin: true,
      email: `super-invite-${randomUUID()}@test.com`,
    })
    superAdminId = superAdmin.userId
    superAdminEmail = superAdmin.email
    superAdminPassword = superAdmin.password

    const tenant = await createTenantWithKey()
    existingTenantId = tenant.tenantId
  })

  afterAll(async () => {
    const db = getDb()
    for (const email of cleanupEmails) {
      await db.delete(signupRequests).where(eq(signupRequests.email, email))
      await db.delete(invites).where(eq(invites.email, email))
      await db.delete(users).where(eq(users.email, email))
    }
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

  it('returns the same 401 for pending signup login (no account enumeration)', async () => {
    const email = `pending-login-${randomUUID()}@test.com`
    cleanupEmails.push(email)
    const db = getDb()
    await db.insert(signupRequests).values({
      tenantName: 'Pending Co',
      email,
      name: 'Pending User',
      passwordHash: await hashPassword(PASSWORD),
      status: 'pending',
    })

    const correct = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD })
    const wrong = await request(app)
      .post('/v1/auth/login')
      .send({ email, password: 'totally-wrong-password' })
    const missing = await request(app)
      .post('/v1/auth/login')
      .send({ email: `missing-${randomUUID()}@test.com`, password: PASSWORD })

    expect(correct.status).toBe(401)
    expect(correct.body.error.code).toBe('unauthorized')
    expect(wrong.status).toBe(401)
    expect(wrong.body.error.code).toBe('unauthorized')
    expect(missing.status).toBe(401)
    expect(missing.body.error.code).toBe('unauthorized')
    expect(correct.body).toEqual(wrong.body)
    expect(correct.body).toEqual(missing.body)
  })

  it('blocks invite creation when a signup request is already pending', async () => {
    const email = `signup-blocks-invite-${randomUUID()}@test.com`
    cleanupEmails.push(email)
    const db = getDb()
    await db.insert(signupRequests).values({
      tenantName: 'Blocked Invite Co',
      email,
      name: 'Blocked',
      passwordHash: await hashPassword(PASSWORD),
      status: 'pending',
    })

    const agent = await loginSuperAdmin()
    const res = await agent.post('/v1/admin/invites').send({
      kind: 'tenant_owner',
      tenant_name: 'Should Fail',
      owner_email: email,
      owner_name: 'Owner',
    })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('conflict')
  })

  it('blocks signup when a non-expired invite is pending', async () => {
    const email = `invite-blocks-signup-${randomUUID()}@test.com`
    cleanupEmails.push(email)
    const agent = await loginSuperAdmin()

    const inviteRes = await agent.post('/v1/admin/invites').send({
      kind: 'tenant_owner',
      tenant_name: `Invite Co ${randomUUID().slice(0, 8)}`,
      owner_email: email,
      owner_name: 'Owner',
    })
    expect(inviteRes.status).toBe(201)

    const signupRes = await request(app).post('/v1/auth/signup').send({
      tenant_name: 'Competing Co',
      email,
      name: 'Owner',
      password: PASSWORD,
    })

    expect(signupRes.status).toBe(409)
    expect(signupRes.body.error.code).toBe('conflict')
  })

  it('allows a new invite after an invite has expired', async () => {
    const email = `expired-invite-${randomUUID()}@test.com`
    cleanupEmails.push(email)
    const db = getDb()
    await db.insert(invites).values({
      tokenHash: `expired-${randomUUID()}`,
      kind: 'tenant_owner',
      email,
      tenantName: 'Expired Co',
      invitedName: 'Owner',
      createdByUserId: superAdminId,
      expiresAt: new Date(Date.now() - 60_000),
    })

    const agent = await loginSuperAdmin()
    const res = await agent.post('/v1/admin/invites').send({
      kind: 'tenant_owner',
      tenant_name: `Fresh Co ${randomUUID().slice(0, 8)}`,
      owner_email: email,
      owner_name: 'Owner',
    })

    expect(res.status).toBe(201)
    expect(res.body.invite_url).toContain('/accept-invite?token=')
  })

  it('rejects a second pending signup for the same email', async () => {
    const email = `dup-signup-${randomUUID()}@test.com`
    cleanupEmails.push(email)

    const first = await request(app).post('/v1/auth/signup').send({
      tenant_name: 'First Co',
      email,
      name: 'Owner',
      password: PASSWORD,
    })
    expect(first.status).toBe(201)

    const second = await request(app).post('/v1/auth/signup').send({
      tenant_name: 'Second Co',
      email,
      name: 'Owner',
      password: PASSWORD,
    })
    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('conflict')
  })

  it('accepts a tenant_user invite and creates the user', async () => {
    const email = `accept-user-${randomUUID()}@test.com`
    cleanupEmails.push(email)
    const agent = await loginSuperAdmin()

    const inviteRes = await agent.post('/v1/admin/invites').send({
      kind: 'tenant_user',
      tenant_id: existingTenantId,
      email,
      name: 'Teammate',
    })
    expect(inviteRes.status).toBe(201)

    const token = new URL(inviteRes.body.invite_url).searchParams.get('token')
    expect(token).toBeTruthy()

    const acceptRes = await request(app).post('/v1/auth/accept-invite').send({
      token,
      name: 'Teammate',
      password: PASSWORD,
    })
    expect(acceptRes.status).toBe(201)
    expect(acceptRes.body.user).toMatchObject({
      email,
      name: 'Teammate',
      is_super_admin: false,
    })

    const [user] = await getDb()
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    expect(user?.tenantId).toBe(existingTenantId)
  })
})
