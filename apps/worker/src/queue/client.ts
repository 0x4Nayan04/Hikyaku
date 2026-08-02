import { Queue } from 'bullmq'
import { enqueueDeliveryJob } from '@webhook/shared/enqueueDelivery'
import { QUEUE_NAME } from '@webhook/shared/constants'
import { getRedisConnectionOptions } from '../lib/redis.js'

export const queue = new Queue(QUEUE_NAME, {
  connection: getRedisConnectionOptions(),
})

/** Enqueue a delivery job, replacing any exhausted completed/failed job with the same id. */
export async function enqueueDelivery(
  deliveryId: string,
  targetQueue: Queue = queue,
): Promise<void> {
  await enqueueDeliveryJob(targetQueue, deliveryId)
}
