import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { tenants } from '@webhook/shared/schema'
import { afterAll, describe, expect, it } from 'vitest'
import { env } from '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'

const app = createApp()

describe('POST /v1/admin/tenants legacy CLI', () => {
  afterAll(async () => {
    await closePool()
    await closeRedis()
  })

  it('creates a tenant and API key with X-Admin-Secret and marks the route deprecated', async () => {
    const name = `Legacy-${randomUUID().slice(0, 8)}`

    const res = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Admin-Secret', env.ADMIN_BOOTSTRAP_SECRET)
      .send({ name })

    expect(res.status).toBe(201)
    expect(res.headers.deprecation).toBe('true')
    expect(res.body.tenant).toMatchObject({ name })
    expect(res.body.api_key).toMatch(/^whk_[0-9a-f]{32}$/)

    const db = getDb()
    await db.delete(tenants).where(eq(tenants.id, res.body.tenant.id))
  })

  it('rejects legacy requests without X-Admin-Secret when no session is present', async () => {
    const res = await request(app)
      .post('/v1/admin/tenants')
      .send({ tenant_name: 'Acme', owner_email: 'a@b.com', owner_password: 'x', owner_name: 'A' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('unauthorized')
  })
})
