import type { NextFunction, Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../src/lib/errors.js'

const takeFixedWindowTokens = vi.fn()

vi.mock('../../../src/lib/rateLimit.js', () => ({
  takeFixedWindowTokens: (...args: unknown[]) => takeFixedWindowTokens(...args),
}))

vi.mock('../../../src/config.js', () => ({
  env: { AUTH_RATE_LIMIT_PER_MINUTE: 20 },
}))

function createRequest(ip: string, email?: string): Request {
  return {
    ip,
    socket: { remoteAddress: ip },
    body: email ? { email } : {},
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
})
