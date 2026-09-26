import { Queue } from 'bullmq'
import { QUEUE_NAME } from '@webhook/shared/constants'
import { env } from '../config.js'
import { logger } from '../lib/logger.js'

// Keep the queue reconnecting; enqueueOr503 bounds the request that waits on it.
export const queue = new Queue(QUEUE_NAME, {
  connection: {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null,
  },
})

queue.on('error', (err) => {
  logger.error({ err }, 'queue_error')
})
