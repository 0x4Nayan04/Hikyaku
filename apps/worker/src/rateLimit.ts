import { RATE_LIMIT_JITTER_MS } from '@hikyaku/shared/constants/config'
import { TAKE_FIXED_WINDOW_TOKENS_LUA, fixedWindowRedisKeys } from '@hikyaku/shared/rateLimitWindow'
import { env } from './config.js'
import { getRedis } from './lib/redis.js'

type RateLimitDecision = { allowed: true } | { allowed: false; retryAt: Date }

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
  const jitter = Math.floor(Math.random() * (RATE_LIMIT_JITTER_MS + 1))
  return { allowed: false, retryAt: new Date(now + ttlMs + jitter) }
}
