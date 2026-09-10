import { Redis } from 'ioredis'
import type { ConnectionOptions } from 'bullmq'
import { env } from '../config.js'

let redis: Redis | undefined

/** One ioredis client for sweeper lock + tenant rate-limit. BullMQ gets URL options, same as the API. */
export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  }
  return redis
}

export function getRedisConnectionOptions(): ConnectionOptions {
  return {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null,
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = undefined
  }
}
