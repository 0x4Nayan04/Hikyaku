import { getRedis } from './redis.js'

const FIXED_WINDOW_MS = 60_000

const TAKE_TOKENS_LUA = `
local max = tonumber(ARGV[1])
for i = 1, #KEYS do
  local current = tonumber(redis.call('GET', KEYS[i]) or '0')
  if current >= max then
    return 0
  end
end
for i = 1, #KEYS do
  local n = redis.call('INCR', KEYS[i])
  if n == 1 then
    redis.call('PEXPIRE', KEYS[i], ARGV[2])
  end
end
return 1
`

/** Fixed-window counters for all keys in one Redis RTT. Fail closed if Redis returns nothing. */
export async function takeFixedWindowTokens(keys: readonly string[], max: number): Promise<boolean> {
  if (keys.length === 0) return true

  const now = Date.now()
  const window = Math.floor(now / FIXED_WINDOW_MS)
  const ttlMs = FIXED_WINDOW_MS - (now % FIXED_WINDOW_MS) || FIXED_WINDOW_MS
  const redisKeys = keys.map((key) => `${key}:${window}`)
  const redis = getRedis()
  const allowed = await redis.eval(
    TAKE_TOKENS_LUA,
    redisKeys.length,
    ...redisKeys,
    String(max),
    String(ttlMs),
  )
  return Number(allowed) === 1
}

/** Fixed-window counter per key per UTC minute. */
export async function takeFixedWindowToken(key: string, max: number): Promise<boolean> {
  return takeFixedWindowTokens([key], max)
}
