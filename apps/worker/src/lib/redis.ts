import { Redis } from 'ioredis'
import { env } from '../config.js'

let redis: Redis | undefined

export function getRedisConnectionOptions() {
  return {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null,
  }
}

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  }
  return redis
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = undefined
  }
}
