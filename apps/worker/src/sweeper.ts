import { randomUUID } from 'node:crypto'
import { deliveries } from '@webhook/shared/schema'
import { enqueueDeliveryJobs } from '@webhook/shared/enqueueDelivery'
import type { Queue } from 'bullmq'
import { and, asc, eq, inArray, isNull, lte, or } from 'drizzle-orm'
import { WORKER_LOCK_DURATION_MS } from './config.js'
import { getDb } from './db/client.js'
import { logger } from './lib/logger.js'
import { queue } from './queue/client.js'
import { getRedis } from './lib/redis.js'

const SWEEP_INTERVAL_MS = 5 * 60 * 1000
const SWEEP_BATCH_SIZE = 100
const SWEEPER_LOCK_KEY = 'webhook-deliveries:sweeper-lock'
const SWEEPER_LOCK_TTL_MS = 4 * 60 * 1000

let sweepTimer: ReturnType<typeof setInterval> | undefined

export async function sweepOrphanDeliveries(sweepQueue: Queue): Promise<void> {
  const db = getDb()
  const now = new Date()
  const staleBefore = new Date(now.getTime() - WORKER_LOCK_DURATION_MS)
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

  const deliveryIds: string[] = []
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
    deliveryIds.push(row.id)
  }

  await enqueueDeliveryJobs(sweepQueue, deliveryIds)
  logger.info({ candidates: candidates.length, enqueued: deliveryIds.length }, 'sweeper_completed')
}

export function startSweeper(): void {
  const runSweep = async () => {
    const redis = getRedis()
    const token = randomUUID()
    let acquired = false

    try {
      acquired =
        (await redis.set(SWEEPER_LOCK_KEY, token, 'PX', SWEEPER_LOCK_TTL_MS, 'NX')) === 'OK'
      if (!acquired) return

      await sweepOrphanDeliveries(queue)
    } catch (err) {
      logger.error({ err }, 'sweeper_failed')
    } finally {
      if (acquired) {
        await redis
          .eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            1,
            SWEEPER_LOCK_KEY,
            token,
          )
          .catch((err) => logger.warn({ err }, 'sweeper_lock_release_failed'))
      }
    }
  }

  void runSweep()

  sweepTimer = setInterval(() => void runSweep(), SWEEP_INTERVAL_MS)
}

export function stopSweeper(): void {
  if (sweepTimer !== undefined) {
    clearInterval(sweepTimer)
    sweepTimer = undefined
  }
}
