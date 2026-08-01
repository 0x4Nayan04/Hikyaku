import { Queue } from 'bullmq'
import { DELIVERY_JOB_OPTIONS, JOB_NAME, QUEUE_NAME } from '@webhook/shared/constants'
import { getRedisConnectionOptions } from '../lib/redis.js'

export type DeliveryJobData = {
  deliveryId: string
}

export const queue = new Queue(QUEUE_NAME, {
  connection: getRedisConnectionOptions(),
})

/** Enqueue a delivery job, replacing any exhausted completed/failed job with the same id. */
export async function enqueueDelivery(deliveryId: string, targetQueue: Queue = queue): Promise<void> {
  const existing = await targetQueue.getJob(deliveryId)
  if (existing) {
    const state = await existing.getState()
    if (state === 'completed' || state === 'failed') {
      await existing.remove()
    } else {
      return
    }
  }

  await targetQueue.add(JOB_NAME, { deliveryId } satisfies DeliveryJobData, {
    jobId: deliveryId,
    ...DELIVERY_JOB_OPTIONS,
  })
}

export async function closeQueue(): Promise<void> {
  await queue.close()
}
