import { Queue } from 'bullmq'
import { QUEUE_NAME } from '@webhook/shared/constants'
import { env } from '../config.js'

// BullMQ requires maxRetriesPerRequest: null, so it cannot share lib/redis.ts
// (request-path client uses maxRetriesPerRequest: 1 + connect/command timeouts).
// FDs per API replica: 1 Queue connection (+ BullMQ duplicate) + 1 rate-limit client.
export const queue = new Queue(QUEUE_NAME, {
  connection: {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null,
  },
})
