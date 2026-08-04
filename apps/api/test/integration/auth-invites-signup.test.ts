import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { invites, users } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createUser, deleteUser } from '../helpers/user.js'

const app = createApp()
const PASSWORD = 'test-password-min-12-chars'

describe('invitation-only onboarding', () => {
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
    existingTenantId = (await createTenantWithKey()).tenantId
  })

  afterAll(async () => {
    const db = getDb()
    for (const email of cleanupEmails) {
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
    const response = await agent
      .post('/v1/auth/login')
      .send({ email: superAdminEmail, password: superAdminPassword })
    expect(response.status).toBe(200)
    return agent
  }

  it('does not expose public signup', async () => {
    const response = await request(app).post('/v1/auth/signup').send({})
    expect(response.status).toBe(404)
  })

  it('invites and creates a new tenant owner', async () => {
    const email = `owner-${randomUUID()}@test.com`
    cleanupEmails.push(email)
    const agent = await loginSuperAdmin()

    const inviteResponse = await agent.post('/v1/admin/invites').send({
      kind: 'tenant_owner',
      tenant_name: `Invite Co ${randomUUID().slice(0, 8)}`,
      owner_email: email,
      owner_name: 'Owner',
    })
    expect(inviteResponse.status).toBe(201)

    const token = new URL(inviteResponse.body.invite_url).searchParams.get('token')
    const acceptResponse = await request(app).post('/v1/auth/accept-invite').send({
      token,
      name: 'Owner',
      password: PASSWORD,
    })
    expect(acceptResponse.status).toBe(201)

    const [user] = await getDb()
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    expect(user?.tenantId).toEqual(expect.any(String))
    if (user?.tenantId) await deleteTenant(user.tenantId)
  })

  it('invites a user to an existing tenant', async () => {
    const email = `member-${randomUUID()}@test.com`
    cleanupEmails.push(email)
    const agent = await loginSuperAdmin()

    const inviteResponse = await agent.post('/v1/admin/invites').send({
      kind: 'tenant_user',
      tenant_id: existingTenantId,
      email,
      name: 'Teammate',
    })
    const token = new URL(inviteResponse.body.invite_url).searchParams.get('token')
    const acceptResponse = await request(app).post('/v1/auth/accept-invite').send({
      token,
      name: 'Teammate',
      password: PASSWORD,
    })

    expect(acceptResponse.status).toBe(201)
    const [user] = await getDb()
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    expect(user?.tenantId).toBe(existingTenantId)
  })

  it('creates only one pending invite for concurrent requests', async () => {
    const email = `duplicate-invite-${randomUUID()}@test.com`
    cleanupEmails.push(email)
    const agent = await loginSuperAdmin()

    const results = await Promise.all(
      [1, 2].map(() =>
        agent.post('/v1/admin/invites').send({
          kind: 'tenant_owner',
          tenant_name: `Invite Co ${randomUUID().slice(0, 8)}`,
          owner_email: email,
        }),
      ),
    )

    expect(results.map((result) => result.status).sort()).toEqual([201, 409])
    expect(results.find((result) => result.status === 409)?.body.error.code).toBe('conflict')

    const rows = await getDb()
      .select({ id: invites.id })
      .from(invites)
      .where(eq(invites.email, email))
    expect(rows).toHaveLength(1)
  })

  it('allows only one concurrent acceptance of an invite', async () => {
    const email = `concurrent-${randomUUID()}@test.com`
    cleanupEmails.push(email)
    const inviteResponse = await (await loginSuperAdmin()).post('/v1/admin/invites').send({
      kind: 'tenant_owner',
      tenant_name: `Concurrent Co ${randomUUID().slice(0, 8)}`,
      owner_email: email,
    })
    const token = new URL(inviteResponse.body.invite_url).searchParams.get('token')

    const results = await Promise.all(
      [1, 2].map(() =>
        request(app)
          .post('/v1/auth/accept-invite')
          .send({ token, name: 'Owner', password: PASSWORD }),
      ),
    )

    expect(results.map((result) => result.status).sort()).toEqual([201, 410])
    expect(results.find((result) => result.status === 410)?.body.error.code).toBe('invite_used')

    const [user] = await getDb()
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    if (user?.tenantId) await deleteTenant(user.tenantId)
  })

  it('rejects accepting an expired invite', async () => {
    const email = `accept-expired-${randomUUID()}@test.com`
    cleanupEmails.push(email)
    const inviteResponse = await (await loginSuperAdmin()).post('/v1/admin/invites').send({
      kind: 'tenant_owner',
      tenant_name: `Expired Accept Co ${randomUUID().slice(0, 8)}`,
      owner_email: email,
    })
    expect(inviteResponse.status).toBe(201)
    const token = new URL(inviteResponse.body.invite_url).searchParams.get('token')

    await getDb()
      .update(invites)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(eq(invites.email, email))

    const acceptResponse = await request(app).post('/v1/auth/accept-invite').send({
      token,
      name: 'Owner',
      password: PASSWORD,
    })
    expect(acceptResponse.status).toBe(410)
    expect(acceptResponse.body.error.code).toBe('invite_expired')
  })

  it('allows a replacement invite after the old invite expires', async () => {
    const email = `expired-${randomUUID()}@test.com`
    cleanupEmails.push(email)
    await getDb()
      .insert(invites)
      .values({
        tokenHash: `expired-${randomUUID()}`,
        kind: 'tenant_owner',
        email,
        tenantName: 'Expired Co',
        createdByUserId: superAdminId,
        expiresAt: new Date(Date.now() - 60_000),
      })

    const response = await (await loginSuperAdmin()).post('/v1/admin/invites').send({
      kind: 'tenant_owner',
      tenant_name: 'Fresh Co',
      owner_email: email,
    })
    expect(response.status).toBe(201)
  })
})
