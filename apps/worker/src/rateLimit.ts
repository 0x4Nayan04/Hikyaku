import { RATE_LIMIT_DEFER_MS, RATE_LIMIT_JITTER_MS } from '@webhook/shared/constants'
import { TAKE_FIXED_WINDOW_TOKENS_LUA, fixedWindowRedisKeys } from '@webhook/shared/rateLimitWindow'
import { env } from './config.js'
import { getRedis } from './lib/redis.js'

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAt: Date }

function retryAtForCurrentWindow(now = Date.now()): Date {
  const windowEnd = (Math.floor(now / RATE_LIMIT_DEFER_MS) + 1) * RATE_LIMIT_DEFER_MS
  const jitter = Math.floor(Math.random() * (RATE_LIMIT_JITTER_MS + 1))
  return new Date(windowEnd + jitter)
}

/** Fixed-window counter per tenant per UTC minute. Increments only when under the cap. */
export async function takeRateLimitToken(tenantId: string): Promise<RateLimitDecision> {
  const now = Date.now()
  const { redisKeys, ttlMs } = fixedWindowRedisKeys([`ratelimit:tenant:${tenantId}`], now)
  const allowed = await getRedis().eval(
    TAKE_FIXED_WINDOW_TOKENS_LUA,
    redisKeys.length,
    ...redisKeys,
    String(env.RATE_LIMIT_PER_MINUTE),
    String(ttlMs),
  )
  if (Number(allowed) === 1) return { allowed: true }
  return { allowed: false, retryAt: retryAtForCurrentWindow(now) }
}
