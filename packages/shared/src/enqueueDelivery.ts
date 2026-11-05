import type { Queue } from 'bullmq'
import { DELIVERY_JOB_OPTIONS, JOB_NAME, type DeliveryJobData } from './constants/queue.js'

export function deliveryJobDedupId(deliveryId: string, replayCount: number): string {
  return `${deliveryId}:${replayCount}`
}

function deliveryJobOptions(job: DeliveryJobData) {
  return {
    ...DELIVERY_JOB_OPTIONS,
    deduplication: { id: deliveryJobDedupId(job.deliveryId, job.replayCount) },
  }
}

export async function enqueueDeliveryJob(
  queue: Queue<DeliveryJobData>,
  job: DeliveryJobData,
): Promise<void> {
  await queue.add(JOB_NAME, job, deliveryJobOptions(job))
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
      opts: deliveryJobOptions(job),
    })),
  )
}
