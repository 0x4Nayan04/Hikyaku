import { Redis } from 'ioredis'
import { env } from '../config.js'

let redis: Redis | undefined

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
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
