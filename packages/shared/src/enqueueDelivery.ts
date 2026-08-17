import type { Queue } from 'bullmq'
import { DELIVERY_JOB_OPTIONS, JOB_NAME, type DeliveryJobData } from './constants.js'

/** Enqueue once per delivery while its current job is still live. */
export async function enqueueDeliveryJob(
  queue: Queue<DeliveryJobData>,
  deliveryId: string,
  tenantId: string,
): Promise<void> {
  await queue.add(JOB_NAME, { deliveryId, tenantId } satisfies DeliveryJobData, {
    ...DELIVERY_JOB_OPTIONS,
    deduplication: { id: deliveryId },
  })
}

/** Enqueue deliveries in one Redis request while keeping per-delivery deduplication. */
export async function enqueueDeliveryJobs(
  queue: Queue<DeliveryJobData>,
  jobs: DeliveryJobData[],
): Promise<void> {
  if (jobs.length === 0) return

  await queue.addBulk(
    jobs.map(({ deliveryId, tenantId }) => ({
      name: JOB_NAME,
      data: { deliveryId, tenantId } satisfies DeliveryJobData,
      opts: { ...DELIVERY_JOB_OPTIONS, deduplication: { id: deliveryId } },
    })),
  )
}
