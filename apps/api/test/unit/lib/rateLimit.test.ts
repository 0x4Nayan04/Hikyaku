import { beforeEach, describe, expect, it, vi } from 'vitest'

const exec = vi.fn()
const transaction = {
  incr: vi.fn(),
  pexpire: vi.fn(),
  exec,
}
transaction.incr.mockReturnValue(transaction)
transaction.pexpire.mockReturnValue(transaction)

vi.mock('../../../src/lib/redis.js', () => ({
  getRedis: () => ({ multi: () => transaction }),
}))

describe('takeFixedWindowToken', () => {
  beforeEach(() => {
    exec.mockReset()
    transaction.incr.mockClear()
    transaction.pexpire.mockClear()
  })

  it('allows requests under the limit and sets TTL on first hit', async () => {
    exec
      .mockResolvedValueOnce([
        [null, 1],
        [null, 1],
      ])
      .mockResolvedValueOnce([
        [null, 2],
        [null, 1],
      ])

    const { takeFixedWindowToken } = await import('../../../src/lib/rateLimit.js')

    await expect(takeFixedWindowToken('auth:ratelimit:ip:127.0.0.1', 2)).resolves.toBe(true)
    expect(transaction.pexpire).toHaveBeenCalledWith(
      expect.stringMatching(/^auth:ratelimit:ip:127\.0\.0\.1:\d+$/),
      60_000,
    )

    await expect(takeFixedWindowToken('auth:ratelimit:ip:127.0.0.1', 2)).resolves.toBe(true)
  })

  it('rejects once the fixed window is exhausted', async () => {
    exec.mockResolvedValue([
      [null, 3],
      [null, 1],
    ])

    const { takeFixedWindowToken } = await import('../../../src/lib/rateLimit.js')

    await expect(takeFixedWindowToken('ingest:ratelimit:tenant-a', 2)).resolves.toBe(false)
  })
})
