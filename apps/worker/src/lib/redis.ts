import { env } from '../config.js'

export function getRedisConnectionOptions() {
  return {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null,
  }
}
