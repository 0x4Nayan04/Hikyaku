import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { tenants, users } from '@webhook/shared/schema'
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
      created_at: expect.any(String),
    })
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
})
