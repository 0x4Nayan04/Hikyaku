import { Queue } from 'bullmq'
import { DELIVERY_JOB_OPTIONS, JOB_NAME, QUEUE_NAME } from '@webhook/shared/constants'
import { getRedisConnectionOptions } from '../lib/redis.js'

export type DeliveryJobData = {
  deliveryId: string
}

export const queue = new Queue(QUEUE_NAME, {
  connection: getRedisConnectionOptions(),
})

export async function enqueueDelivery(deliveryId: string): Promise<void> {
  await queue.add(JOB_NAME, { deliveryId } satisfies DeliveryJobData, {
    jobId: deliveryId,
    ...DELIVERY_JOB_OPTIONS,
  })
}

export async function closeQueue(): Promise<void> {
  await queue.close()
}
