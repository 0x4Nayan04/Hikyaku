import { Redis } from 'ioredis'
import type { ConnectionOptions } from 'bullmq'
import { redisConnectionOptions } from '@webhook/shared/redis'
import { env } from '../config.js'
import { logger } from './logger.js'

let redis: Redis | undefined

/** One ioredis client for sweeper lock + tenant rate-limit. BullMQ gets URL options, same as the API. */
export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(redisConnectionOptions(env.REDIS_URL, null))
    redis.on('error', (err) => {
      logger.error({ err }, 'redis_error')
    })
  }
  return redis
}

export function getRedisConnectionOptions(): ConnectionOptions {
  return redisConnectionOptions(env.REDIS_URL, null)
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = undefined
  }
}
