import { deliveries } from '@webhook/shared/schema'
import type { Queue } from 'bullmq'
import { inArray } from 'drizzle-orm'
import { getDb } from './db/client.js'
import { logger } from './lib/logger.js'
import { type DeliveryJobData, enqueueDelivery, queue } from './queue/client.js'

const SWEEP_INTERVAL_MS = 5 * 60 * 1000
const SWEEP_BATCH_LIMIT = 100

let sweepTimer: ReturnType<typeof setInterval> | undefined

function collectInFlightDeliveryIds(jobs: { id?: string; data: unknown }[]): Set<string> {
  const inFlightIds = new Set<string>()

  for (const job of jobs) {
    if (job.id) {
      inFlightIds.add(job.id)
    }

    const deliveryId = (job.data as DeliveryJobData | undefined)?.deliveryId
    if (deliveryId) {
      inFlightIds.add(deliveryId)
    }
  }

  return inFlightIds
}

export async function sweepOrphanDeliveries(sweepQueue: Queue): Promise<void> {
  const inFlightJobs = await sweepQueue.getJobs(['waiting', 'delayed', 'active'], 0, SWEEP_BATCH_LIMIT - 1)
  const inFlightIds = collectInFlightDeliveryIds(inFlightJobs)

  const db = getDb()
  const candidates = await db
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(inArray(deliveries.status, ['pending', 'deferred']))
    .limit(SWEEP_BATCH_LIMIT)

  for (const row of candidates) {
    if (inFlightIds.has(row.id)) {
      continue
    }

    await enqueueDelivery(row.id)
    logger.info({ delivery_id: row.id }, 'sweeper_re_enqueued')
  }
}

export function startSweeper(): void {
  const runSweep = () => {
    void sweepOrphanDeliveries(queue).catch((err) => {
      logger.error({ err }, 'sweeper_failed')
    })
  }

  runSweep()

  sweepTimer = setInterval(runSweep, SWEEP_INTERVAL_MS)
}

export function stopSweeper(): void {
  if (sweepTimer !== undefined) {
    clearInterval(sweepTimer)
    sweepTimer = undefined
  }
}
