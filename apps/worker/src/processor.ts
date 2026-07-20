import { RATE_LIMIT_DEFER_MS } from '@webhook/shared/constants'
import { signPayload } from '@webhook/shared/crypto'
import { deliveryAttempts, deliveries, endpoints, events } from '@webhook/shared/schema'
import { checkWebhookUrl } from '@webhook/shared/webhookUrl'
import { DelayedError, type Job } from 'bullmq'
import { eq, max } from 'drizzle-orm'
import { calculateBackoffDelayMs } from './backoff.js'
import { env } from './config.js'
import { getDb } from './db/client.js'
import { postWithTimeout } from './httpClient.js'
import { logger } from './lib/logger.js'
import { takeRateLimitToken } from './rateLimit.js'
import { reevaluateEventStatus } from './status.js'

export type DeliveryJobData = {
  deliveryId: string
}

type DeliveryContext = {
  id: string
  tenantId: string
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

type HttpAttemptFields = {
  httpStatus: number | null
  responseBody: string | null
  error: string | null
  durationMs: number
}

async function loadDeliveryContext(deliveryId: string): Promise<DeliveryContext | null> {
  const db = getDb()
  const [row] = await db
    .select({
      id: deliveries.id,
      tenantId: deliveries.tenantId,
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

/** Audit-only path for disabled endpoint or HTTP cap; does not increment attempt_count. */
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
        nextRetryAt: null,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId))
    await reevaluateEventStatus(eventId, tx)
  })
}

async function recordRateLimitedDefer(deliveryId: string, eventId: string): Promise<void> {
  const db = getDb()
  const attemptNumber = await nextAttemptNumber(deliveryId)

  await db.transaction(async (tx) => {
    await tx.insert(deliveryAttempts).values({
      deliveryId,
      attemptNumber,
      error: 'rate_limited',
    })
    await tx
      .update(deliveries)
      .set({
        status: 'deferred',
        nextRetryAt: new Date(Date.now() + RATE_LIMIT_DEFER_MS),
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId))
    await reevaluateEventStatus(eventId, tx)
  })
}

async function markInProgress(deliveryId: string, eventId: string): Promise<void> {
  const db = getDb()
  await db.transaction(async (tx) => {
    await tx
      .update(deliveries)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(eq(deliveries.id, deliveryId))
    await reevaluateEventStatus(eventId, tx)
  })
}

async function recordSuccess(
  deliveryId: string,
  eventId: string,
  attemptCount: number,
  httpStatus: number,
  responseBody: string | null,
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
      durationMs,
    })
    await tx
      .update(deliveries)
      .set({
        attemptCount: attemptCount + 1,
        status: 'succeeded',
        lastError: null,
        nextRetryAt: null,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId))
    await reevaluateEventStatus(eventId, tx)
  })
}

async function recordFailureWithAttempt(
  deliveryId: string,
  eventId: string,
  attemptCount: number,
  lastError: string,
  attempt: HttpAttemptFields,
): Promise<void> {
  const db = getDb()
  const attemptNumber = await nextAttemptNumber(deliveryId)

  await db.transaction(async (tx) => {
    await tx.insert(deliveryAttempts).values({
      deliveryId,
      attemptNumber,
      httpStatus: attempt.httpStatus,
      responseBody: attempt.responseBody,
      error: attempt.error,
      durationMs: attempt.durationMs,
    })
    await tx
      .update(deliveries)
      .set({
        attemptCount: attemptCount + 1,
        status: 'failed',
        lastError,
        nextRetryAt: null,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId))
    await reevaluateEventStatus(eventId, tx)
  })
}

async function recordRetryableFailure(
  deliveryId: string,
  eventId: string,
  attemptCount: number,
  attemptCountAfterHttp: number,
  lastError: string,
  attempt: HttpAttemptFields,
): Promise<void> {
  const db = getDb()
  const attemptNumber = await nextAttemptNumber(deliveryId)
  const delayMs = calculateBackoffDelayMs(attemptCountAfterHttp)

  await db.transaction(async (tx) => {
    await tx.insert(deliveryAttempts).values({
      deliveryId,
      attemptNumber,
      httpStatus: attempt.httpStatus,
      responseBody: attempt.responseBody,
      error: attempt.error,
      durationMs: attempt.durationMs,
    })
    await tx
      .update(deliveries)
      .set({
        attemptCount: attemptCount + 1,
        status: 'pending',
        lastError,
        nextRetryAt: new Date(Date.now() + delayMs),
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId))
    await reevaluateEventStatus(eventId, tx)
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

/** 408, 429, and 5xx are retried; all other non-2xx statuses fail fast. */
export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

export type DeliveryTransportError = 'timeout' | 'network_error'

export function classifyDeliveryError(err: unknown): DeliveryTransportError {
  if (err instanceof Error && err.name === 'AbortError') {
    return 'timeout'
  }
  return 'network_error'
}

export async function processor(job: Job<DeliveryJobData>, token?: string): Promise<void> {
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

  const urlCheck = await checkWebhookUrl(row.url, {
    allowPrivate: env.NODE_ENV !== 'production',
  })
  if (!urlCheck.ok) {
    await recordShortCircuitFail(row.id, row.eventId, 'blocked_url')
    log.info({ reason: urlCheck.reason }, 'blocked_url')
    return
  }

  if (row.attemptCount >= env.MAX_DELIVERY_ATTEMPTS) {
    await recordShortCircuitFail(row.id, row.eventId, 'max_attempts')
    log.info('max_attempts')
    return
  }

  const allowed = await takeRateLimitToken(row.tenantId)
  if (!allowed) {
    await recordRateLimitedDefer(row.id, row.eventId)
    await job.moveToDelayed(Date.now() + RATE_LIMIT_DEFER_MS, token)
    log.info('rate_limited_deferred')
    throw new DelayedError()
  }

  const body = buildOutboundBody(row)
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = signPayload(row.secret, timestamp, body)

  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Id': row.id,
    'X-Webhook-Timestamp': String(timestamp),
    'X-Webhook-Signature': signature,
    'User-Agent': 'Hikyaku/1.0',
  }

  await markInProgress(row.id, row.eventId)

  const start = Date.now()
  const attemptCountAfterHttp = row.attemptCount + 1
  let httpStatus: number | null = null
  let responseBody: string | null = null
  let error: string | null = null

  try {
    const result = await postWithTimeout(row.url, body, headers, env.DELIVERY_TIMEOUT_MS)
    httpStatus = result.status
    responseBody = result.body

    if (httpStatus >= 200 && httpStatus < 300) {
      await recordSuccess(
        row.id,
        row.eventId,
        row.attemptCount,
        httpStatus,
        responseBody,
        Date.now() - start,
      )
      log.info({ http_status: httpStatus }, 'delivery_succeeded')
      return
    }

    log.info({ http_status: httpStatus }, 'delivery_http_failure')

    if (!isRetryableHttpStatus(httpStatus)) {
      await recordFailureWithAttempt(row.id, row.eventId, row.attemptCount, `http_${httpStatus}`, {
        httpStatus,
        responseBody,
        error: null,
        durationMs: Date.now() - start,
      })
      log.info({ last_error: `http_${httpStatus}` }, 'delivery_failed_fast')
      return
    }
  } catch (err) {
    error = classifyDeliveryError(err)
    log.info({ error }, 'delivery_transport_failure')
  }

  const attempt: HttpAttemptFields = {
    httpStatus,
    responseBody,
    error,
    durationMs: Date.now() - start,
  }

  if (attemptCountAfterHttp >= env.MAX_DELIVERY_ATTEMPTS) {
    await recordFailureWithAttempt(row.id, row.eventId, row.attemptCount, 'max_attempts', attempt)
    log.info({ attempt_count: attemptCountAfterHttp }, 'delivery_dead_letter')
    return
  }

  const lastError = error ?? `http_${httpStatus}`
  await recordRetryableFailure(
    row.id,
    row.eventId,
    row.attemptCount,
    attemptCountAfterHttp,
    lastError,
    attempt,
  )
  log.info({ last_error: lastError, attempt_count: attemptCountAfterHttp }, 'delivery_retrying')
  throw new Error(lastError)
}
