import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createUser, deleteUser } from '../helpers/user.js'

const app = createApp()

const emptyStats = {
  events_today: 0,
  deliveries_active: 0,
  deliveries_succeeded_24h: 0,
  deliveries_failed_24h: 0,
  success_rate_24h: null,
}

describe('session auth on tenant routes', () => {
  let tenantId: string
  let apiKey: string
  let userId: string
  let email: string
  let password: string

  beforeAll(async () => {
    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    apiKey = tenant.apiKey

    const user = await createUser({
      tenantId,
      email: `session-${randomUUID()}@test.com`,
    })
    userId = user.userId
    email = user.email
    password = user.password
  })

  afterAll(async () => {
    await deleteUser(userId)
    await deleteTenant(tenantId)
    await closePool()
    await closeRedis()
  })

  it('returns 200 for GET /v1/stats after login sets a session cookie', async () => {
    const agent = request.agent(app)

    const loginRes = await agent.post('/v1/auth/login').send({ email, password })
    expect(loginRes.status).toBe(200)
    expect(loginRes.body.user).toMatchObject({
      email,
      is_super_admin: false,
    })

    const statsRes = await agent.get('/v1/stats')
    expect(statsRes.status).toBe(200)
    expect(statsRes.body).toEqual(emptyStats)
  })

  it('returns the session user and tenant from GET /v1/auth/me', async () => {
    const agent = request.agent(app)

    const loginRes = await agent.post('/v1/auth/login').send({ email, password })
    expect(loginRes.status).toBe(200)

    const meRes = await agent.get('/v1/auth/me')
    expect(meRes.status).toBe(200)
    expect(meRes.body.user).toMatchObject({
      id: userId,
      email,
      is_super_admin: false,
    })
    expect(meRes.body.tenant).toMatchObject({ id: tenantId })
    expect(typeof meRes.body.tenant.name).toBe('string')
  })

  it('regenerates the session ID after a successful login', async () => {
    const agent = request.agent(app)

    const firstLogin = await agent.post('/v1/auth/login').send({ email, password })
    const secondLogin = await agent.post('/v1/auth/login').send({ email, password })

    expect(firstLogin.status).toBe(200)
    expect(secondLogin.status).toBe(200)
    expect(firstLogin.headers['set-cookie']?.[0]).not.toEqual(
      secondLogin.headers['set-cookie']?.[0],
    )
  })

  it('returns 401 for GET /v1/stats with a valid Bearer token', async () => {
    const res = await request(app).get('/v1/stats').set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(401)
  })

  it('returns 401 for GET /v1/stats without auth', async () => {
    const res = await request(app).get('/v1/stats')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Missing or invalid Bearer token or session',
      },
    })
  })

  it('returns 401 for GET /v1/stats with an invalid session cookie', async () => {
    const res = await request(app).get('/v1/stats').set('Cookie', 'sid=not-a-real-session')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Missing or invalid Bearer token or session',
      },
    })
  })

  it('returns 401 for GET /v1/stats after logout clears the session', async () => {
    const agent = request.agent(app)

    const loginRes = await agent.post('/v1/auth/login').send({ email, password })
    expect(loginRes.status).toBe(200)

    const logoutRes = await agent.post('/v1/auth/logout')
    expect(logoutRes.status).toBe(204)

    const statsRes = await agent.get('/v1/stats')
    expect(statsRes.status).toBe(401)
    expect(statsRes.body).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Missing or invalid Bearer token or session',
      },
    })
  })

  it('returns 401 for a super-admin session on GET /v1/stats', async () => {
    const admin = await createUser({
      tenantId: null,
      isSuperAdmin: true,
      email: `super-admin-${randomUUID()}@test.com`,
    })

    const agent = request.agent(app)
    const loginRes = await agent.post('/v1/auth/login').send({
      email: admin.email,
      password: admin.password,
    })
    expect(loginRes.status).toBe(200)

    const statsRes = await agent.get('/v1/stats')
    expect(statsRes.status).toBe(401)
    expect(statsRes.body).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Missing or invalid Bearer token or session',
      },
    })

    await deleteUser(admin.userId)
  })
})
