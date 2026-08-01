import { beforeEach, describe, expect, it, vi } from 'vitest'

const incr = vi.fn()
const pexpire = vi.fn()

vi.mock('../../../src/lib/redis.js', () => ({
  getRedis: () => ({ incr, pexpire }),
}))

vi.mock('../../../src/config.js', () => ({
  env: {
    AUTH_RATE_LIMIT_PER_MINUTE: 2,
  },
}))

describe('takeAuthRateLimitToken', () => {
  beforeEach(() => {
    incr.mockReset()
    pexpire.mockReset()
  })

  it('allows requests under the limit and sets TTL on first hit', async () => {
    incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2)
    pexpire.mockResolvedValue(1)

    const { takeAuthRateLimitToken } = await import('../../../src/lib/authRateLimit.js')

    await expect(takeAuthRateLimitToken('127.0.0.1')).resolves.toBe(true)
    expect(pexpire).toHaveBeenCalledWith(expect.stringContaining('auth:ratelimit:127.0.0.1:'), 60_000)

    await expect(takeAuthRateLimitToken('127.0.0.1')).resolves.toBe(true)
  })

  it('rejects once the fixed window is exhausted', async () => {
    incr.mockResolvedValue(3)

    const { takeAuthRateLimitToken } = await import('../../../src/lib/authRateLimit.js')

    await expect(takeAuthRateLimitToken('127.0.0.1')).resolves.toBe(false)
  })
})
