import type { NextFunction, Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../src/lib/errors.js'

const takeFixedWindowToken = vi.fn()

vi.mock('../../../src/lib/rateLimit.js', () => ({
  takeFixedWindowToken: (...args: unknown[]) => takeFixedWindowToken(...args),
}))

vi.mock('../../../src/config.js', () => ({
  env: { INGEST_RATE_LIMIT_PER_MINUTE: 120 },
}))

vi.mock('../../../src/lib/authRateLimit.js', () => ({
  readAuthRateLimitIp: () => '203.0.113.10',
}))

function createRequest(authorization?: string, tenantId?: string): Request {
  return {
    get(name: string) {
      if (name.toLowerCase() === 'authorization') {
        return authorization
      }
      return undefined
    },
    tenantId,
  } as Request
}

async function runMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  req: Request,
): Promise<{ error?: unknown }> {
  return new Promise((resolve) => {
    const next: NextFunction = (err?: unknown) => {
      resolve(err ? { error: err } : {})
    }
    middleware(req, {} as Response, next)
  })
}

describe('ingestIpRateLimit', () => {
  beforeEach(() => {
    takeFixedWindowToken.mockReset()
  })

  it('skips Redis when the request is not Bearer ingest', async () => {
    const { ingestIpRateLimit } = await import('../../../src/lib/ingestRateLimit.js')
    const result = await runMiddleware(ingestIpRateLimit, createRequest())

    expect(result.error).toBeUndefined()
    expect(takeFixedWindowToken).not.toHaveBeenCalled()
  })

  it('takes an IP token before API-key lookup', async () => {
    takeFixedWindowToken.mockResolvedValue(true)
    const { ingestIpRateLimit } = await import('../../../src/lib/ingestRateLimit.js')
    const result = await runMiddleware(ingestIpRateLimit, createRequest('Bearer whk_test'))

    expect(result.error).toBeUndefined()
    expect(takeFixedWindowToken).toHaveBeenCalledWith('ingest:ratelimit:ip:203.0.113.10', 120)
  })

  it('returns 429 when the IP window is exhausted', async () => {
    takeFixedWindowToken.mockResolvedValue(false)
    const { ingestIpRateLimit } = await import('../../../src/lib/ingestRateLimit.js')
    const result = await runMiddleware(ingestIpRateLimit, createRequest('Bearer whk_test'))

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({ statusCode: 429, code: 'rate_limited' })
  })

  it('fails closed when Redis errors', async () => {
    takeFixedWindowToken.mockRejectedValue(new Error('redis down'))
    const { ingestIpRateLimit } = await import('../../../src/lib/ingestRateLimit.js')
    const result = await runMiddleware(ingestIpRateLimit, createRequest('Bearer whk_test'))

    expect(result.error).toBeInstanceOf(Error)
    expect((result.error as Error).message).toBe('redis down')
  })
})
