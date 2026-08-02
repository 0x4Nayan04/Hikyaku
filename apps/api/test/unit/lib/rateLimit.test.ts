import { beforeEach, describe, expect, it, vi } from 'vitest'

const incr = vi.fn()
const pexpire = vi.fn()

vi.mock('../../../src/lib/redis.js', () => ({
  getRedis: () => ({ incr, pexpire }),
}))

describe('takeFixedWindowToken', () => {
  beforeEach(() => {
    incr.mockReset()
    pexpire.mockReset()
  })

  it('allows requests under the limit and sets TTL on first hit', async () => {
    incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2)
    pexpire.mockResolvedValue(1)

    const { takeFixedWindowToken } = await import('../../../src/lib/rateLimit.js')

    await expect(takeFixedWindowToken('auth:ratelimit:ip:127.0.0.1', 2)).resolves.toBe(true)
    expect(pexpire).toHaveBeenCalledWith(
      expect.stringMatching(/^auth:ratelimit:ip:127\.0\.0\.1:\d+$/),
      60_000,
    )

    await expect(takeFixedWindowToken('auth:ratelimit:ip:127.0.0.1', 2)).resolves.toBe(true)
  })

  it('rejects once the fixed window is exhausted', async () => {
    incr.mockResolvedValue(3)

    const { takeFixedWindowToken } = await import('../../../src/lib/rateLimit.js')

    await expect(takeFixedWindowToken('ingest:ratelimit:tenant-a', 2)).resolves.toBe(false)
  })
})
