import type { Queue } from 'bullmq'
import { DELIVERY_JOB_OPTIONS, JOB_NAME, type DeliveryJobData } from './constants.js'

export function deliveryJobDedupId(deliveryId: string, replayCount: number): string {
  return `${deliveryId}:${replayCount}`
}

export async function enqueueDeliveryJob(
  queue: Queue<DeliveryJobData>,
  deliveryId: string,
  tenantId: string,
  replayCount: number,
): Promise<void> {
  await queue.add(JOB_NAME, { deliveryId, tenantId, replayCount } satisfies DeliveryJobData, {
    ...DELIVERY_JOB_OPTIONS,
    deduplication: { id: deliveryJobDedupId(deliveryId, replayCount) },
  })
}

export async function enqueueDeliveryJobs(
  queue: Queue<DeliveryJobData>,
  jobs: DeliveryJobData[],
): Promise<void> {
  if (jobs.length === 0) return

  await queue.addBulk(
    jobs.map((job) => ({
      name: JOB_NAME,
      data: job,
      opts: {
        ...DELIVERY_JOB_OPTIONS,
        deduplication: { id: deliveryJobDedupId(job.deliveryId, job.replayCount) },
      },
    })),
  )
}
