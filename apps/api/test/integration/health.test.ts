import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { closePool } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'

const app = createApp()

describe('GET /v1/health', () => {
  it('returns 200 with liveness payload', async () => {
    const res = await request(app).get('/v1/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.headers['x-request-id']).toBeTruthy()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['referrer-policy']).toBe('no-referrer')
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    )
  })

  it('includes revision when BUILD_REVISION is set', async () => {
    const previous = process.env.BUILD_REVISION
    process.env.BUILD_REVISION = 'test-revision-abc'
    try {
      const res = await request(app).get('/v1/health')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ status: 'ok', revision: 'test-revision-abc' })
    } finally {
      if (previous === undefined) {
        delete process.env.BUILD_REVISION
      } else {
        process.env.BUILD_REVISION = previous
      }
    }
  })
})

describe('GET /v1/ready', () => {
  afterAll(async () => {
    await closePool()
    await closeRedis()
  })

  it('returns 200 when Postgres and Redis are reachable', async () => {
    const res = await request(app).get('/v1/ready')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      status: 'ready',
      postgres: 'up',
      redis: 'up',
    })
  })
})
