import { describe, expect, it } from 'vitest'
import { serializeRequestForLog } from '../../src/lib/requestLog.js'

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
