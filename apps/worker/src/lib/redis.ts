import { Redis } from 'ioredis'
import type { ConnectionOptions } from 'bullmq'
import { env } from '../config.js'

let redis: Redis | undefined

/**
 * One ioredis client for sweeper lock + tenant rate-limit.
 * Pass into BullMQ `{ connection }`; Queue/Worker each duplicate it
 * (they require maxRetriesPerRequest: null). Duplicate ioredis versions
 * in the lockfile make Redis ≉ ConnectionOptions, hence the cast.
 * FDs per worker replica ≈ 1 shared + 1 Queue + 1 Worker (+ blocking/subscriber).
 */
export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  }
  return redis
}

export function getRedisConnectionOptions(): ConnectionOptions {
  return getRedis() as unknown as ConnectionOptions
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = undefined
  }
}
