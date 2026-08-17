import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { RATE_LIMIT_DEFER_MS, RATE_LIMIT_JITTER_MS } from '@webhook/shared/constants'
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
    const ids = tenantIds.splice(0)
    if (ids.length === 0) return
    const keys = (
      await Promise.all(ids.map((id) => redis.keys(`ratelimit:tenant:${id}:*`)))
    ).flat()
    if (keys.length > 0) await redis.del(...keys)
  })

  afterAll(async () => {
    await closeRedis()
  })

  it('allows a burst up to RATE_LIMIT_PER_MINUTE', async () => {
    const tenantId = uniqueTenantId()
    const limit = env.RATE_LIMIT_PER_MINUTE

    for (let i = 0; i < limit; i += 1) {
      expect(await takeRateLimitToken(tenantId)).toEqual({ allowed: true })
    }
  })

  it('denies the call after the burst allowance is exhausted', async () => {
    const tenantId = uniqueTenantId()
    const limit = env.RATE_LIMIT_PER_MINUTE

    for (let i = 0; i < limit; i += 1) {
      await takeRateLimitToken(tenantId)
    }

    expect(await takeRateLimitToken(tenantId)).toMatchObject({ allowed: false })
  })

  it('does not increment the counter after the cap is reached', async () => {
    const tenantId = uniqueTenantId()
    const limit = env.RATE_LIMIT_PER_MINUTE

    for (let i = 0; i < limit; i += 1) {
      await takeRateLimitToken(tenantId)
    }
    await takeRateLimitToken(tenantId)
    await takeRateLimitToken(tenantId)

    const bucket = Math.floor(Date.now() / RATE_LIMIT_DEFER_MS)
    const count = await getRedis().get(`ratelimit:tenant:${tenantId}:${bucket}`)
    expect(Number(count)).toBe(limit)
  })

  it('wakes at window end plus jitter when denied', async () => {
    const tenantId = uniqueTenantId()
    const limit = env.RATE_LIMIT_PER_MINUTE

    for (let i = 0; i < limit; i += 1) {
      await takeRateLimitToken(tenantId)
    }

    const denied = await takeRateLimitToken(tenantId)
    expect(denied.allowed).toBe(false)
    if (denied.allowed) return

    const windowEnd = (Math.floor(Date.now() / RATE_LIMIT_DEFER_MS) + 1) * RATE_LIMIT_DEFER_MS
    expect(denied.retryAt.getTime()).toBeGreaterThanOrEqual(windowEnd)
    expect(denied.retryAt.getTime()).toBeLessThanOrEqual(windowEnd + RATE_LIMIT_JITTER_MS)
  })

  it('refills tokens after elapsed time', async () => {
    const tenantId = uniqueTenantId()
    const limit = env.RATE_LIMIT_PER_MINUTE

    for (let i = 0; i < limit; i += 1) {
      await takeRateLimitToken(tenantId)
    }
    expect(await takeRateLimitToken(tenantId)).toMatchObject({ allowed: false })

    const anchor = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(anchor + 60_000)

    expect(await takeRateLimitToken(tenantId)).toEqual({ allowed: true })
  })
})
