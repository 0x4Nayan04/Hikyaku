import { deliveries } from '@webhook/shared/schema'
import type { Queue } from 'bullmq'
import { and, asc, eq, inArray, isNull, lte, or } from 'drizzle-orm'
import { getDb } from './db/client.js'
import { logger } from './lib/logger.js'
import { enqueueDelivery, queue } from './queue/client.js'

const SWEEP_INTERVAL_MS = 5 * 60 * 1000
const SWEEP_BATCH_SIZE = 100

let sweepTimer: ReturnType<typeof setInterval> | undefined

export async function sweepOrphanDeliveries(sweepQueue: Queue): Promise<void> {
  const db = getDb()
  const now = new Date()
  const staleBefore = new Date(now.getTime() - SWEEP_INTERVAL_MS)
  const candidates = await db
    .select({ id: deliveries.id, status: deliveries.status, updatedAt: deliveries.updatedAt })
    .from(deliveries)
    .where(
      or(
        and(
          inArray(deliveries.status, ['pending']),
          lte(deliveries.updatedAt, staleBefore),
          or(isNull(deliveries.nextRetryAt), lte(deliveries.nextRetryAt, now)),
        ),
        and(eq(deliveries.status, 'in_progress'), lte(deliveries.updatedAt, staleBefore)),
      ),
    )
    .orderBy(asc(deliveries.updatedAt))
    .limit(SWEEP_BATCH_SIZE)

  for (const row of candidates) {
    // Reset stuck in_progress so the worker can claim (status must be pending).
    if (row.status === 'in_progress') {
      const [reclaimed] = await db
        .update(deliveries)
        .set({ status: 'pending', updatedAt: new Date() })
        .where(
          and(
            eq(deliveries.id, row.id),
            eq(deliveries.status, 'in_progress'),
            eq(deliveries.updatedAt, row.updatedAt),
          ),
        )
        .returning({ id: deliveries.id })
      if (!reclaimed) continue
    }
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
