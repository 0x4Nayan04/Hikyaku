import type { Queue } from 'bullmq'
import { DELIVERY_JOB_OPTIONS, JOB_NAME, type DeliveryJobData } from './constants.js'

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

/** Enqueue deliveries in one Redis request while keeping per-delivery deduplication. */
export async function enqueueDeliveryJobs(
  queue: Queue<DeliveryJobData>,
  deliveryIds: string[],
): Promise<void> {
  if (deliveryIds.length === 0) return

  await queue.addBulk(
    deliveryIds.map((deliveryId) => ({
      name: JOB_NAME,
      data: { deliveryId } satisfies DeliveryJobData,
      opts: { ...DELIVERY_JOB_OPTIONS, deduplication: { id: deliveryId } },
    })),
  )
}
