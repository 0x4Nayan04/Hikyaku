import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../src/config.js'
import { closeRedis, getRedis } from '../../src/lib/redis.js'
import { takeRateLimitToken } from '../../src/rateLimit.js'

describe('takeRateLimitToken', () => {
  const tenantIds: string[] = []

  function uniqueTenantId(): string {
    const id = `rate-limit-${crypto.randomUUID()}`
    tenantIds.push(id)
    return id
  }

  afterEach(async () => {
    vi.restoreAllMocks()
    const redis = getRedis()
    await Promise.all(tenantIds.splice(0).map((id) => redis.del(`ratelimit:tenant:${id}`)))
  })

  afterAll(async () => {
    await closeRedis()
  })

  it('allows a burst up to RATE_LIMIT_PER_MINUTE', async () => {
    const tenantId = uniqueTenantId()
    const limit = env.RATE_LIMIT_PER_MINUTE

    for (let i = 0; i < limit; i += 1) {
      expect(await takeRateLimitToken(tenantId)).toBe(true)
    }
  })

  it('denies the call after the burst allowance is exhausted', async () => {
    const tenantId = uniqueTenantId()
    const limit = env.RATE_LIMIT_PER_MINUTE

    for (let i = 0; i < limit; i += 1) {
      await takeRateLimitToken(tenantId)
    }

    expect(await takeRateLimitToken(tenantId)).toBe(false)
  })

  it('refills tokens after elapsed time', async () => {
    const tenantId = uniqueTenantId()
    const limit = env.RATE_LIMIT_PER_MINUTE

    for (let i = 0; i < limit; i += 1) {
      await takeRateLimitToken(tenantId)
    }
    expect(await takeRateLimitToken(tenantId)).toBe(false)

    const anchor = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(anchor + 60_000)

    expect(await takeRateLimitToken(tenantId)).toBe(true)
  })
})
