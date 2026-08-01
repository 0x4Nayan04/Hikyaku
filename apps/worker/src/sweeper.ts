import { deliveries } from '@webhook/shared/schema'
import type { Queue } from 'bullmq'
import { inArray } from 'drizzle-orm'
import { getDb } from './db/client.js'
import { logger } from './lib/logger.js'
import { enqueueDelivery, queue } from './queue/client.js'

const SWEEP_INTERVAL_MS = 5 * 60 * 1000

let sweepTimer: ReturnType<typeof setInterval> | undefined

export async function sweepOrphanDeliveries(sweepQueue: Queue): Promise<void> {
  const db = getDb()
  const candidates = await db
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(inArray(deliveries.status, ['pending', 'deferred', 'in_progress']))

  for (const row of candidates) {
    await enqueueDelivery(row.id, sweepQueue)
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
