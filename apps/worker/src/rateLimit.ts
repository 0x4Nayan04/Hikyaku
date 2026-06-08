import { env } from './config.js'
import { getRedis } from './lib/redis.js'

const BUCKET_IDLE_EXPIRE_MS = 120_000

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_per_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(data[1]) or capacity
local last = tonumber(data[2]) or now

local elapsed = math.max(0, now - last)
tokens = math.min(capacity, tokens + elapsed * refill_per_ms)

local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end

redis.call('HSET', key, 'tokens', tokens, 'last_refill', now)
redis.call('PEXPIRE', key, ${BUCKET_IDLE_EXPIRE_MS})
return allowed
`

let scriptSha: string | undefined
let scriptLoadPromise: Promise<string> | undefined

async function ensureScriptLoaded(): Promise<string> {
  if (scriptSha) {
    return scriptSha
  }

  if (!scriptLoadPromise) {
    scriptLoadPromise = (async () => {
      const sha = String(await getRedis().script('LOAD', TOKEN_BUCKET_SCRIPT))
      scriptSha = sha
      return sha
    })()
  }

  return scriptLoadPromise
}

function isNoscriptError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('NOSCRIPT')
}

export async function takeRateLimitToken(tenantId: string): Promise<boolean> {
  const key = `ratelimit:tenant:${tenantId}`
  const capacity = env.RATE_LIMIT_PER_MINUTE
  const refillPerMs = capacity / 60_000
  const now = Date.now()
  const cost = 1

  const redis = getRedis()
  const sha = await ensureScriptLoaded()

  try {
    const result = await redis.evalsha(sha, 1, key, capacity, refillPerMs, now, cost)
    return result === 1
  } catch (err) {
    if (!isNoscriptError(err)) {
      throw err
    }

    scriptSha = undefined
    scriptLoadPromise = undefined
    const reloadedSha = await ensureScriptLoaded()
    const result = await redis.evalsha(reloadedSha, 1, key, capacity, refillPerMs, now, cost)
    return result === 1
  }
}
