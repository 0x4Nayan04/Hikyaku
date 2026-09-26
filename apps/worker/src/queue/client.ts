import { Queue } from 'bullmq'
import { QUEUE_NAME } from '@webhook/shared/constants'
import { logger } from '../lib/logger.js'
import { getRedisConnectionOptions } from '../lib/redis.js'

export const queue = new Queue(QUEUE_NAME, {
  connection: getRedisConnectionOptions(),
})

queue.on('error', (err) => {
  logger.error({ err }, 'queue_error')
})
