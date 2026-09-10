import { Queue } from 'bullmq'
import { QUEUE_NAME } from '@webhook/shared/constants'
import { getRedisConnectionOptions } from '../lib/redis.js'

export const queue = new Queue(QUEUE_NAME, {
  connection: getRedisConnectionOptions(),
})
