import { deliveryOutbox } from '@hikyaku/shared/schema'
import { inArray } from 'drizzle-orm'
import { getDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

/** Acknowledge durable outbox rows only after the queue accepts their jobs. */
export async function enqueueAndAcknowledge(
  work: Promise<void>,
  deliveryIds: string[],
  extra: Record<string, unknown>,
  message: string,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('enqueue_timeout')), 3_000)
      }),
    ])
  } catch (err) {
    logger.error({ ...extra, err }, message)
    throw new AppError(503, 'service_unavailable', 'Service temporarily unavailable')
  } finally {
    if (timer) clearTimeout(timer)
  }

  if (deliveryIds.length > 0) {
    await getDb().delete(deliveryOutbox).where(inArray(deliveryOutbox.deliveryId, deliveryIds))
  }
}
