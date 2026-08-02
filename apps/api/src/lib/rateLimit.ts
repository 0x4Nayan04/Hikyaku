import { getRedis } from './redis.js'

const FIXED_WINDOW_MS = 60_000

/** Fixed-window counter per key per UTC minute. */
export async function takeFixedWindowToken(key: string, max: number): Promise<boolean> {
  const redisKey = `${key}:${Math.floor(Date.now() / FIXED_WINDOW_MS)}`
  const redis = getRedis()
  const count = await redis.incr(redisKey)
  if (count === 1) {
    await redis.pexpire(redisKey, FIXED_WINDOW_MS)
  }
  return count <= max
}
