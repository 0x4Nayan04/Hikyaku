import type { NextFunction, Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROXY_CLIENT_IP_HEADER, PROXY_SECRET_HEADER } from '../../../src/lib/proxyUpstream.js'
import { AppError } from '../../../src/lib/errors.js'

const takeFixedWindowTokens = vi.fn()
const { envState } = vi.hoisted(() => ({
  envState: {
    LOG_LEVEL: 'silent',
    AUTH_RATE_LIMIT_PER_MINUTE: 20,
    PROXY_IP_SECRET: undefined as string | undefined,
  },
}))

vi.mock('../../../src/lib/rateLimit.js', () => ({
  takeFixedWindowTokens: (...args: unknown[]) => takeFixedWindowTokens(...args),
}))

vi.mock('../../../src/config.js', () => ({
  env: envState,
}))

function createRequest(ip: string, email?: string, headers: Record<string, string> = {}): Request {
  return {
    ip,
    socket: { remoteAddress: ip },
    body: email ? { email } : {},
    header(name: string) {
      return headers[name.toLowerCase()]
    },
  } as Request
}

async function runAuthRateLimit(req: Request): Promise<{ error?: unknown }> {
  const { authRateLimit } = await import('../../../src/lib/authRateLimit.js')
  return new Promise((resolve) => {
    const next: NextFunction = (err?: unknown) => {
      resolve(err ? { error: err } : {})
    }
    authRateLimit(req, {} as Response, next)
  })
}

describe('authRateLimit', () => {
  beforeEach(() => {
    takeFixedWindowTokens.mockReset()
    envState.PROXY_IP_SECRET = undefined
  })

  it('takes IP and email tokens in one call', async () => {
    takeFixedWindowTokens.mockResolvedValue(true)
    const result = await runAuthRateLimit(createRequest('203.0.113.10', 'Ada@Example.com'))

    expect(result.error).toBeUndefined()
    expect(takeFixedWindowTokens).toHaveBeenCalledTimes(1)
    expect(takeFixedWindowTokens).toHaveBeenCalledWith(
      ['auth:ratelimit:ip:203.0.113.10', 'auth:ratelimit:email:ada@example.com'],
      20,
    )
  })

  it('returns 429 when the window is exhausted', async () => {
    takeFixedWindowTokens.mockResolvedValue(false)
    const result = await runAuthRateLimit(createRequest('203.0.113.10', 'ada@example.com'))

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({ statusCode: 429, code: 'rate_limited' })
  })

  it('uses the browser IP when the proxy secret matches', async () => {
    envState.PROXY_IP_SECRET = 'proxy-secret-min-16'
    takeFixedWindowTokens.mockResolvedValue(true)
    const result = await runAuthRateLimit(
      createRequest('10.0.0.1', undefined, {
        [PROXY_SECRET_HEADER]: 'proxy-secret-min-16',
        [PROXY_CLIENT_IP_HEADER]: '203.0.113.50',
      }),
    )

    expect(result.error).toBeUndefined()
    expect(takeFixedWindowTokens).toHaveBeenCalledWith(['auth:ratelimit:ip:203.0.113.50'], 20)
  })

  it('keeps the socket IP when the proxy secret does not match', async () => {
    envState.PROXY_IP_SECRET = 'proxy-secret-min-16'
    takeFixedWindowTokens.mockResolvedValue(true)
    const result = await runAuthRateLimit(
      createRequest('10.0.0.1', undefined, {
        [PROXY_SECRET_HEADER]: 'wrong-secret-value!',
        [PROXY_CLIENT_IP_HEADER]: '203.0.113.50',
      }),
    )

    expect(result.error).toBeUndefined()
    expect(takeFixedWindowTokens).toHaveBeenCalledWith(['auth:ratelimit:ip:10.0.0.1'], 20)
  })
})
