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
    expect(res.body).toEqual({ status: 'ok' })
    expect(res.headers['x-request-id']).toBeTruthy()
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
    expect(res.body).toEqual({
      status: 'ready',
      postgres: 'up',
      redis: 'up',
    })
  })
})
