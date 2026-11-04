import type { Queue } from 'bullmq'
import { DELIVERY_JOB_OPTIONS, JOB_NAME, type DeliveryJobData } from './constants/queue.js'

export function deliveryJobDedupId(deliveryId: string, replayCount: number): string {
  return `${deliveryId}:${replayCount}`
}

export function enqueueDeliveryJob(
  queue: Queue<DeliveryJobData>,
  job: DeliveryJobData,
): Promise<void>
export function enqueueDeliveryJob(
  queue: Queue<DeliveryJobData>,
  deliveryId: string,
  tenantId: string,
  replayCount: number,
): Promise<void>
export async function enqueueDeliveryJob(
  queue: Queue<DeliveryJobData>,
  jobOrId: DeliveryJobData | string,
  tenantId?: string,
  replayCount?: number,
): Promise<void> {
  let job: DeliveryJobData
  if (typeof jobOrId === 'string') {
    if (tenantId === undefined || replayCount === undefined) {
      throw new Error('delivery_job_payload_missing')
    }
    job = { deliveryId: jobOrId, tenantId, replayCount }
  } else {
    job = jobOrId
  }
  await queue.add(JOB_NAME, job, {
    ...DELIVERY_JOB_OPTIONS,
    deduplication: { id: deliveryJobDedupId(job.deliveryId, job.replayCount) },
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
