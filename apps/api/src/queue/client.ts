import { Queue } from 'bullmq'
import { QUEUE_NAME } from '@webhook/shared/constants'
import { env } from '../config.js'

export const queue = new Queue(QUEUE_NAME, {
  connection: {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null,
  },
})
