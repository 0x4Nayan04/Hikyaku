import type { Queue } from 'bullmq'
import {
  DELIVERY_JOB_OPTIONS,
  JOB_NAME,
  type DeliveryJobData,
} from './constants.js'

/** Enqueue once per delivery while its current job is still live. */
export async function enqueueDeliveryJob(
  queue: Queue<DeliveryJobData>,
  deliveryId: string,
): Promise<void> {
  await queue.add(JOB_NAME, { deliveryId } satisfies DeliveryJobData, {
    ...DELIVERY_JOB_OPTIONS,
    deduplication: { id: deliveryId },
  })
}
