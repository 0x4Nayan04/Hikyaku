import type { Queue } from 'bullmq'
import {
  DELIVERY_JOB_OPTIONS,
  JOB_NAME,
  type DeliveryJobData,
} from './constants.js'

/**
 * Enqueue a delivery job.
 * - force=false (default): skip if a live job exists; replace completed/failed.
 * - force=true: remove any existing job, then add (replay).
 */
export async function enqueueDeliveryJob(
  queue: Queue<DeliveryJobData>,
  deliveryId: string,
  options: { force?: boolean } = {},
): Promise<void> {
  const existing = await queue.getJob(deliveryId)
  if (existing) {
    if (options.force) {
      await existing.remove()
    } else {
      const state = await existing.getState()
      if (state === 'completed' || state === 'failed') {
        await existing.remove()
      } else {
        return
      }
    }
  }

  await queue.add(JOB_NAME, { deliveryId } satisfies DeliveryJobData, {
    jobId: deliveryId,
    ...DELIVERY_JOB_OPTIONS,
  })
}
