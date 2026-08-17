import { beforeEach, describe, expect, it, vi } from 'vitest'

const evalMock = vi.fn()

vi.mock('../../../src/lib/redis.js', () => ({
  getRedis: () => ({ eval: evalMock }),
}))

describe('takeFixedWindowToken', () => {
  beforeEach(() => {
    evalMock.mockReset()
  })

  it('allows requests under the limit', async () => {
    evalMock.mockResolvedValueOnce(1).mockResolvedValueOnce(1)

    const { takeFixedWindowToken } = await import('../../../src/lib/rateLimit.js')

    await expect(takeFixedWindowToken('auth:ratelimit:ip:127.0.0.1', 2)).resolves.toBe(true)
    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining('INCR'),
      1,
      expect.stringMatching(/^auth:ratelimit:ip:127\.0\.0\.1:\d+$/),
      '2',
      expect.stringMatching(/^\d+$/),
    )

    await expect(takeFixedWindowToken('auth:ratelimit:ip:127.0.0.1', 2)).resolves.toBe(true)
  })

  it('rejects once the fixed window is exhausted', async () => {
    evalMock.mockResolvedValue(0)

    const { takeFixedWindowToken } = await import('../../../src/lib/rateLimit.js')

    await expect(takeFixedWindowToken('ingest:ratelimit:tenant-a', 2)).resolves.toBe(false)
  })
})

describe('takeFixedWindowTokens', () => {
  beforeEach(() => {
    evalMock.mockReset()
  })

  it('evaluates every key in one script', async () => {
    evalMock.mockResolvedValue(1)

    const { takeFixedWindowTokens } = await import('../../../src/lib/rateLimit.js')

    await expect(
      takeFixedWindowTokens(['auth:ratelimit:ip:127.0.0.1', 'auth:ratelimit:email:a@b.com'], 20),
    ).resolves.toBe(true)
    expect(evalMock).toHaveBeenCalledTimes(1)
    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining('INCR'),
      2,
      expect.stringMatching(/^auth:ratelimit:ip:127\.0\.0\.1:\d+$/),
      expect.stringMatching(/^auth:ratelimit:email:a@b\.com:\d+$/),
      '20',
      expect.stringMatching(/^\d+$/),
    )
  })

  it('rejects when any key is over the limit', async () => {
    evalMock.mockResolvedValue(0)

    const { takeFixedWindowTokens } = await import('../../../src/lib/rateLimit.js')

    await expect(takeFixedWindowTokens(['auth:ip', 'auth:email'], 20)).resolves.toBe(false)
  })
})
