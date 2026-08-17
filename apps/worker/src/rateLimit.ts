import { RATE_LIMIT_DEFER_MS, RATE_LIMIT_JITTER_MS } from '@webhook/shared/constants'
import { env } from './config.js'
import { getRedis } from './lib/redis.js'

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAt: Date }

const TAKE_TOKEN_LUA = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local max = tonumber(ARGV[1])
if current >= max then
  return 0
end
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 1
`

function retryAtForCurrentWindow(now = Date.now()): Date {
  const windowEnd = (Math.floor(now / RATE_LIMIT_DEFER_MS) + 1) * RATE_LIMIT_DEFER_MS
  const jitter = Math.floor(Math.random() * (RATE_LIMIT_JITTER_MS + 1))
  return new Date(windowEnd + jitter)
}

/** Fixed-window counter per tenant per UTC minute. Increments only when under the cap. */
export async function takeRateLimitToken(tenantId: string): Promise<RateLimitDecision> {
  const now = Date.now()
  const bucket = Math.floor(now / RATE_LIMIT_DEFER_MS)
  const ttlMs = RATE_LIMIT_DEFER_MS - (now % RATE_LIMIT_DEFER_MS) || RATE_LIMIT_DEFER_MS
  const key = `ratelimit:tenant:${tenantId}:${bucket}`
  const redis = getRedis()
  const allowed = await redis.eval(
    TAKE_TOKEN_LUA,
    1,
    key,
    String(env.RATE_LIMIT_PER_MINUTE),
    String(ttlMs),
  )
  if (Number(allowed) === 1) return { allowed: true }
  return { allowed: false, retryAt: retryAtForCurrentWindow(now) }
}
