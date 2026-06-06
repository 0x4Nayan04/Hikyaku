import { Queue } from 'bullmq'
import { BULLMQ_JOB_ATTEMPTS, JOB_NAME, QUEUE_NAME } from '@webhook/shared/constants'
import { env } from '../config.js'

export type DeliveryJobData = {
  deliveryId: string
}

export const queue = new Queue(QUEUE_NAME, {
  connection: {
    url: env.REDIS_URL,
    maxRetriesPerRequest: null,
  },
})

export async function enqueueDelivery(deliveryId: string): Promise<void> {
  await queue.add(JOB_NAME, { deliveryId } satisfies DeliveryJobData, {
    jobId: deliveryId,
    attempts: BULLMQ_JOB_ATTEMPTS,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  })
}
