import { count, eq } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { users } from '@webhook/shared/schema'
import { env } from '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createUser, deleteUser } from '../helpers/user.js'

const app = createApp()

const bootstrapPayload = {
  email: `bootstrap-${Date.now()}@test.com`,
  password: 'secure-password-min-12-chars',
  name: 'Platform Admin',
}

describe('POST /v1/auth/bootstrap', () => {
  let usersExistAtStart = false
  let createdBootstrapUserId: string | undefined

  beforeAll(async () => {
    const [countRow] = await getDb().select({ value: count() }).from(users)
    usersExistAtStart = (countRow?.value ?? 0) > 0
  })

  afterAll(async () => {
    if (createdBootstrapUserId) {
      await deleteUser(createdBootstrapUserId)
    }
    await closePool()
    await closeRedis()
  })

  it('GET /v1/auth/bootstrap-status reflects whether users exist', async () => {
    const { userId } = await createUser({ tenantId: null, isSuperAdmin: true })

    const unavailable = await request(app).get('/v1/auth/bootstrap-status')
    expect(unavailable.status).toBe(200)
    expect(unavailable.body).toEqual({ available: false })

    await deleteUser(userId)

    if (!usersExistAtStart) {
      const [remaining] = await getDb().select({ value: count() }).from(users)
      if ((remaining?.value ?? 0) === 0) {
        const available = await request(app).get('/v1/auth/bootstrap-status')
        expect(available.status).toBe(200)
        expect(available.body).toEqual({ available: true })
      }
    }
  })

  it('returns 401 for a wrong X-Admin-Secret', async () => {
    const res = await request(app)
      .post('/v1/auth/bootstrap')
      .set('X-Admin-Secret', 'wrong-secret')
      .send(bootstrapPayload)

    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      error: { code: 'invalid_admin_secret', message: 'Wrong or missing X-Admin-Secret' },
    })
  })

  it('returns 403 when any user already exists', async () => {
    const { userId } = await createUser({ tenantId: null, isSuperAdmin: true })

    const res = await request(app)
      .post('/v1/auth/bootstrap')
      .set('X-Admin-Secret', env.ADMIN_BOOTSTRAP_SECRET)
      .send(bootstrapPayload)

    expect(res.status).toBe(403)
    expect(res.body).toEqual({
      error: { code: 'forbidden', message: 'Bootstrap is disabled' },
    })

    await deleteUser(userId)
  })

  it('creates the first super-admin when no users exist', async () => {
    if (usersExistAtStart) {
      return
    }

    const res = await request(app)
      .post('/v1/auth/bootstrap')
      .set('X-Admin-Secret', env.ADMIN_BOOTSTRAP_SECRET)
      .send(bootstrapPayload)

    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({
      email: bootstrapPayload.email,
      is_super_admin: true,
    })
    expect(res.body.user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )

    const rows = await getDb()
      .select({
        id: users.id,
        tenantId: users.tenantId,
        isSuperAdmin: users.isSuperAdmin,
      })
      .from(users)
      .where(eq(users.email, bootstrapPayload.email))
      .limit(1)

    expect(rows[0]).toMatchObject({
      tenantId: null,
      isSuperAdmin: true,
    })

    createdBootstrapUserId = rows[0]?.id
  })
})
