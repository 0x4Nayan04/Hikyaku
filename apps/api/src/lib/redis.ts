import { Redis } from 'ioredis'
import { env } from '../config.js'

/** Request-path client. Cannot share with BullMQ (queue/client.ts needs maxRetriesPerRequest: null). */
export const RATE_LIMIT_REDIS_OPTIONS = {
  maxRetriesPerRequest: 1,
  connectTimeout: 2_000,
  commandTimeout: 1_000,
} as const

let redis: Redis | undefined

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, RATE_LIMIT_REDIS_OPTIONS)
  }
  return redis
}

export async function checkRedis(): Promise<boolean> {
  try {
    return (await getRedis().ping()) === 'PONG'
  } catch {
    return false
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = undefined
  }
}
