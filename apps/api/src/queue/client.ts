import { Queue } from 'bullmq'
import { DELIVERY_JOB_OPTIONS, JOB_NAME, QUEUE_NAME } from '@webhook/shared/constants'
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
    ...DELIVERY_JOB_OPTIONS,
  })
}

export async function reEnqueueDelivery(deliveryId: string): Promise<void> {
  const existing = await queue.getJob(deliveryId)
  if (existing) {
    await existing.remove()
  }

  await enqueueDelivery(deliveryId)
}
