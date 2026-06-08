import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { env } from '../../src/config.js'
import { closePool } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { parseCorsOrigins } from '../../src/lib/cors.js'
import { createApp } from '../../src/server.js'

const app = createApp()
const allowedOrigin = parseCorsOrigins(env.CORS_ORIGIN)[0]

describe('CORS credentials', () => {
  afterAll(async () => {
    await closePool()
    await closeRedis()
  })

  it('returns Access-Control-Allow-Credentials for allowed origin preflight', async () => {
    const res = await request(app)
      .options('/v1/health')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'GET')

    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-credentials']).toBe('true')
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin)
  })

  it('returns Access-Control-Allow-Credentials for allowed origin GET', async () => {
    const res = await request(app).get('/v1/health').set('Origin', allowedOrigin)

    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-credentials']).toBe('true')
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin)
  })
})
