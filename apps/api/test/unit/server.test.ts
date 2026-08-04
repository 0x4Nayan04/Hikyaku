import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { serializeRequestForLog, serializeResponseForLog } from '../../src/lib/requestLog.js'
import { createApp } from '../../src/server.js'

describe('serializeRequestForLog', () => {
  it('excludes request headers and query strings', () => {
    expect(
      serializeRequestForLog({
        id: 'request-id',
        method: 'GET',
        url: '/v1/auth/invites/validate?token=invite-secret',
        headers: { authorization: 'Bearer api-key', cookie: 'session=secret' },
      }),
    ).toEqual({
      id: 'request-id',
      method: 'GET',
      url: '/v1/auth/invites/validate',
      remoteAddress: undefined,
      remotePort: undefined,
    })
  })
})

describe('serializeResponseForLog', () => {
  it('drops set-cookie headers case-insensitively', () => {
    expect(
      serializeResponseForLog({
        statusCode: 201,
        headers: { 'Set-Cookie': 'session=secret', 'x-custom': 'yes' },
      }),
    ).toEqual({
      statusCode: 201,
      headers: { 'x-custom': 'yes' },
    })
  })
})

describe('security headers', () => {
  it('does not advertise Express via X-Powered-By', async () => {
    const app = createApp()
    const res = await request(app).get('/v1/health')

    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('ignores client-supplied X-Request-Id', async () => {
    const app = createApp()
    const res = await request(app).get('/v1/health').set('X-Request-Id', 'client-supplied-not-a-uuid')

    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(res.headers['x-request-id']).not.toBe('client-supplied-not-a-uuid')
  })
})

describe('request body too large', () => {
  it('returns 413 for oversized JSON bodies', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ big: 'x'.repeat(300 * 1024) })

    expect(res.status).toBe(413)
    expect(res.body).toEqual({
      error: { code: 'payload_too_large', message: 'Request body too large' },
    })
  })
})
