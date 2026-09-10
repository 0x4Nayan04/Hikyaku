import { RATE_LIMIT_DEFER_MS } from './constants.js'

export const TAKE_FIXED_WINDOW_TOKENS_LUA = `
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

export function fixedWindowRedisKeys(
  keys: readonly string[],
  now = Date.now(),
): { redisKeys: string[]; ttlMs: number } {
  const window = Math.floor(now / RATE_LIMIT_DEFER_MS)
  const ttlMs = RATE_LIMIT_DEFER_MS - (now % RATE_LIMIT_DEFER_MS) || RATE_LIMIT_DEFER_MS
  return { redisKeys: keys.map((key) => `${key}:${window}`), ttlMs }
}
