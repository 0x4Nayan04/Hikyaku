import { env } from './config.js'
import { getRedis } from './lib/redis.js'

/** Fixed-window counter per tenant per UTC minute. */
export async function takeRateLimitToken(tenantId: string): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 60_000)
  const key = `ratelimit:tenant:${tenantId}:${bucket}`
  const redis = getRedis()
  const results = await redis.multi().incr(key).pexpire(key, 60_000).exec()
  const count = Number(results?.[0]?.[1])
  return count <= env.RATE_LIMIT_PER_MINUTE
}
