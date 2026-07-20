import { beforeEach, describe, expect, it, vi } from 'vitest'

const incr = vi.fn()
const pexpire = vi.fn()

vi.mock('../../../src/lib/redis.js', () => ({
  getRedis: () => ({ incr, pexpire }),
}))

vi.mock('../../../src/config.js', () => ({
  env: {
    INGEST_RATE_LIMIT_PER_MINUTE: 2,
  },
}))

describe('takeIngestRateLimitToken', () => {
  beforeEach(() => {
    incr.mockReset()
    pexpire.mockReset()
  })

  it('allows requests under the limit and sets TTL on first hit', async () => {
    incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2)
    pexpire.mockResolvedValue(1)

    const { takeIngestRateLimitToken } = await import('../../../src/lib/ingestRateLimit.js')

    await expect(takeIngestRateLimitToken('tenant-a')).resolves.toBe(true)
    expect(pexpire).toHaveBeenCalledWith(expect.stringContaining('ingest:ratelimit:tenant-a:'), 60_000)

    await expect(takeIngestRateLimitToken('tenant-a')).resolves.toBe(true)
  })

  it('rejects once the fixed window is exhausted', async () => {
    incr.mockResolvedValue(3)

    const { takeIngestRateLimitToken } = await import('../../../src/lib/ingestRateLimit.js')

    await expect(takeIngestRateLimitToken('tenant-a')).resolves.toBe(false)
  })
})
