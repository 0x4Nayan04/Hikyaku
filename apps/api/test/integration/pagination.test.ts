import request from 'supertest'
import { endpoints } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'

const app = createApp()

describe('list endpoint pagination', () => {
  let tenantId: string
  let apiKey: string

  beforeAll(async () => {
    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    apiKey = tenant.apiKey

    const db = getDb()
    await db.insert(endpoints).values(
      Array.from({ length: 3 }, (_, index) => ({
        tenantId,
        url: `https://webhook.site/page-${index}`,
        secret: 'whsec_' + 'b'.repeat(32),
      })),
    )
  })

  afterAll(async () => {
    await deleteTenant(tenantId)
    await closePool()
    await closeRedis()
  })

  it('paginates GET /v1/endpoints', async () => {
    const res = await request(app)
      .get('/v1/endpoints?limit=2&offset=1')
      .set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      total: 3,
      limit: 2,
      offset: 1,
    })
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data.every((row: { secret?: string }) => row.secret === undefined)).toBe(true)
  })

  it('paginates GET /v1/events', async () => {
    for (const key of ['evt-a', 'evt-b', 'evt-c']) {
      const ingest = await request(app)
        .post('/v1/events')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ idempotency_key: key, type: 'test', payload: {} })

      expect(ingest.status).toBe(202)
    }

    const res = await request(app)
      .get('/v1/events?limit=1&offset=2')
      .set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      total: 3,
      limit: 1,
      offset: 2,
    })
    expect(res.body.data).toHaveLength(1)
  })

  it('paginates GET /v1/deliveries', async () => {
    const res = await request(app)
      .get('/v1/deliveries?limit=2&offset=0')
      .set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      total: 9,
      limit: 2,
      offset: 0,
    })
    expect(res.body.data).toHaveLength(2)
  })
})
