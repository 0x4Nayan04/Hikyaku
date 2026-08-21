import { randomUUID } from 'node:crypto'
import { QUEUE_NAME } from '@webhook/shared/constants'
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
const SWEEPER_LOCK_KEY = `${QUEUE_NAME}:sweeper-lock`
const SWEEPER_LOCK_TTL_MS = 4 * 60 * 1000

let sweepTimer: ReturnType<typeof setInterval> | undefined

export async function sweepOrphanDeliveries(
  sweepQueue: Queue,
  lockDeadlineMs = Number.POSITIVE_INFINITY,
): Promise<void> {
  const db = getDb()
  let totalCandidates = 0
  let totalEnqueued = 0

  for (;;) {
    const now = new Date()
    const staleBefore = new Date(now.getTime() - WORKER_LOCK_DURATION_MS)
    const candidates = await db
      .select({
        id: deliveries.id,
        tenantId: deliveries.tenantId,
        status: deliveries.status,
        updatedAt: deliveries.updatedAt,
      })
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

    totalCandidates += candidates.length
    if (candidates.length === 0) break

    const pendingIds = candidates.filter((row) => row.status === 'pending').map((row) => row.id)
    const inProgressIds = candidates
      .filter((row) => row.status === 'in_progress')
      .map((row) => row.id)

    const jobs: { deliveryId: string; tenantId: string }[] = []

    if (pendingIds.length > 0) {
      const pending = await db
        .update(deliveries)
        .set({ updatedAt: now })
        .where(
          and(
            inArray(deliveries.id, pendingIds),
            eq(deliveries.status, 'pending'),
            lte(deliveries.updatedAt, staleBefore),
          ),
        )
        .returning({ id: deliveries.id, tenantId: deliveries.tenantId })
      jobs.push(...pending.map((row) => ({ deliveryId: row.id, tenantId: row.tenantId })))
    }

    if (inProgressIds.length > 0) {
      const reclaimed = await db
        .update(deliveries)
        .set({ status: 'pending', updatedAt: now })
        .where(
          and(
            inArray(deliveries.id, inProgressIds),
            eq(deliveries.status, 'in_progress'),
            lte(deliveries.updatedAt, staleBefore),
          ),
        )
        .returning({ id: deliveries.id, tenantId: deliveries.tenantId })
      jobs.push(...reclaimed.map((row) => ({ deliveryId: row.id, tenantId: row.tenantId })))
    }

    await enqueueDeliveryJobs(sweepQueue, jobs)
    totalEnqueued += jobs.length

    if (candidates.length < SWEEP_BATCH_SIZE || Date.now() >= lockDeadlineMs) break
  }

  logger.info({ candidates: totalCandidates, enqueued: totalEnqueued }, 'sweeper_completed')
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

      await sweepOrphanDeliveries(queue, Date.now() + SWEEPER_LOCK_TTL_MS)
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
