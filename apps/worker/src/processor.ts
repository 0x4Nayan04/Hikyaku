import { signPayload } from '@webhook/shared/crypto'
import { deliveryAttempts, deliveries, endpoints, events } from '@webhook/shared/schema'
import type { Job } from 'bullmq'
import { eq, max } from 'drizzle-orm'
import { env } from './config.js'
import { getDb } from './db/client.js'
import { postWithTimeout } from './httpClient.js'
import { logger } from './lib/logger.js'
import { reevaluateEventStatus } from './status.js'

export type DeliveryJobData = {
  deliveryId: string
}

type DeliveryContext = {
  id: string
  eventId: string
  status: string
  attemptCount: number
  eventType: string
  eventPayload: unknown
  eventCreatedAt: Date
  url: string
  secret: string
  endpointStatus: string
}

async function loadDeliveryContext(deliveryId: string): Promise<DeliveryContext | null> {
  const db = getDb()
  const [row] = await db
    .select({
      id: deliveries.id,
      eventId: deliveries.eventId,
      status: deliveries.status,
      attemptCount: deliveries.attemptCount,
      eventType: events.type,
      eventPayload: events.payload,
      eventCreatedAt: events.createdAt,
      url: endpoints.url,
      secret: endpoints.secret,
      endpointStatus: endpoints.status,
    })
    .from(deliveries)
    .innerJoin(events, eq(events.id, deliveries.eventId))
    .innerJoin(endpoints, eq(endpoints.id, deliveries.endpointId))
    .where(eq(deliveries.id, deliveryId))
    .limit(1)

  return row ?? null
}

async function nextAttemptNumber(deliveryId: string): Promise<number> {
  const db = getDb()
  const [result] = await db
    .select({ value: max(deliveryAttempts.attemptNumber) })
    .from(deliveryAttempts)
    .where(eq(deliveryAttempts.deliveryId, deliveryId))

  return (result?.value ?? 0) + 1
}

async function recordShortCircuitFail(
  deliveryId: string,
  eventId: string,
  error: string,
): Promise<void> {
  const db = getDb()
  const attemptNumber = await nextAttemptNumber(deliveryId)

  await db.transaction(async (tx) => {
    await tx.insert(deliveryAttempts).values({
      deliveryId,
      attemptNumber,
      error,
    })
    await tx
      .update(deliveries)
      .set({
        status: 'failed',
        lastError: error,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId))
    await reevaluateEventStatus(eventId, tx)
  })
}

async function markSucceeded(deliveryId: string, eventId: string): Promise<void> {
  const db = getDb()
  await db.transaction(async (tx) => {
    await tx
      .update(deliveries)
      .set({
        status: 'succeeded',
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId))
    await reevaluateEventStatus(eventId, tx)
  })
}

async function recordHttpAttempt(
  deliveryId: string,
  attemptCount: number,
  httpStatus: number | null,
  responseBody: string | null,
  error: string | null,
  durationMs: number,
): Promise<void> {
  const db = getDb()
  const attemptNumber = await nextAttemptNumber(deliveryId)

  await db.transaction(async (tx) => {
    await tx.insert(deliveryAttempts).values({
      deliveryId,
      attemptNumber,
      httpStatus,
      responseBody,
      error,
      durationMs,
    })
    await tx
      .update(deliveries)
      .set({
        attemptCount: attemptCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId))
  })
}

function buildOutboundBody(row: DeliveryContext): string {
  return JSON.stringify({
    id: row.eventId,
    type: row.eventType,
    created_at: row.eventCreatedAt.toISOString(),
    data: row.eventPayload,
  })
}

export async function processor(job: Job<DeliveryJobData>): Promise<void> {
  const { deliveryId } = job.data
  const log = logger.child({ delivery_id: deliveryId })

  const row = await loadDeliveryContext(deliveryId)
  if (!row) {
    log.info('delivery_not_found')
    return
  }

  if (row.status === 'succeeded' || row.status === 'failed') {
    log.info({ status: row.status }, 'already_terminal')
    return
  }

  if (row.endpointStatus === 'disabled') {
    await recordShortCircuitFail(row.id, row.eventId, 'endpoint_disabled')
    log.info('endpoint_disabled')
    return
  }

  if (row.attemptCount >= env.MAX_DELIVERY_ATTEMPTS) {
    await recordShortCircuitFail(row.id, row.eventId, 'max_attempts')
    log.info('max_attempts')
    return
  }

  const body = buildOutboundBody(row)
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = signPayload(row.secret, timestamp, body)

  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Id': row.id,
    'X-Webhook-Timestamp': String(timestamp),
    'X-Webhook-Signature': signature,
    'User-Agent': 'WebhookDelivery/1.0',
  }

  try {
    const result = await postWithTimeout(row.url, body, headers, env.DELIVERY_TIMEOUT_MS)
    await recordHttpAttempt(
      row.id,
      row.attemptCount,
      result.status,
      result.body,
      null,
      result.durationMs,
    )

    if (result.status >= 200 && result.status < 300) {
      await markSucceeded(row.id, row.eventId)
      log.info({ http_status: result.status }, 'delivery_succeeded')
      return
    }

    log.info({ http_status: result.status }, 'delivery_http_failure')
  } catch (err) {
    const error = err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network_error'
    await recordHttpAttempt(row.id, row.attemptCount, null, null, error, 0)
    log.info({ error }, 'delivery_network_failure')
  }
}
