import { env } from '../config.js'
import { TAKE_FIXED_WINDOW_TOKENS_LUA, fixedWindowRedisKeys } from '@webhook/shared/rateLimitWindow'
import { getRedis } from './redis.js'

/** Fixed-window counters for all keys in one Redis RTT. Fail closed if Redis returns nothing. */
export async function takeFixedWindowTokens(keys: readonly string[], max: number): Promise<boolean> {
  if (keys.length === 0) return true

  const { redisKeys, ttlMs } = fixedWindowRedisKeys(env.NODE_ENV === 'test' ? keys.map(key => `test-${process.env.TEST_RUN_ID}:${key}`) : keys)
  const allowed = await getRedis().eval(
    TAKE_FIXED_WINDOW_TOKENS_LUA,
    redisKeys.length,
    ...redisKeys,
    String(max),
    String(ttlMs),
  )
  return Number(allowed) === 1
}

export async function takeFixedWindowToken(key: string, max: number): Promise<boolean> {
  return takeFixedWindowTokens([key], max)
}
