import { RATE_LIMIT_DEFER_MS } from '@webhook/shared/constants'
import type { DeliveryJobData } from '@webhook/shared/constants'
import { signPayload } from '@webhook/shared/crypto'
import { reevaluateEventStatus } from '@webhook/shared/eventStatus'
import { deliveryAttempts, deliveries, endpoints, events } from '@webhook/shared/schema'
import { DelayedError, type Job } from 'bullmq'
import { and, eq, max } from 'drizzle-orm'
import { calculateBackoffDelayMs } from './backoff.js'
import { env } from './config.js'
import { getDb } from './db/client.js'
import { postWithTimeout } from './httpClient.js'
import { logger } from './lib/logger.js'
import { takeRateLimitToken } from './rateLimit.js'

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

type AttemptOutcome = Partial<HttpAttemptFields> & { error?: string | null }

type DeliveryOutcome = {
  status: 'in_progress' | 'succeeded' | 'failed' | 'pending'
  attemptCount?: number
  lastError?: string | null
  nextRetryAt?: Date | null
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

async function recordOutcome(
  deliveryId: string,
  eventId: string,
  leaseStartedAt: Date,
  delivery: DeliveryOutcome,
  attempt?: AttemptOutcome,
): Promise<boolean> {
  const db = getDb()
  const attemptNumber = attempt ? await nextAttemptNumber(deliveryId) : null

  return db.transaction(async (tx) => {
    // Lease check: ignore stale writers after sweeper reclaim / another worker finished.
    const [updated] = await tx
      .update(deliveries)
      .set({
        ...delivery,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(deliveries.id, deliveryId),
          eq(deliveries.status, 'in_progress'),
          eq(deliveries.updatedAt, leaseStartedAt),
        ),
      )
      .returning({ id: deliveries.id })

    if (!updated) {
      logger.info({ delivery_id: deliveryId }, 'outcome_lease_lost')
      return false
    }

    if (attempt && attemptNumber !== null) {
      await tx.insert(deliveryAttempts).values({ deliveryId, attemptNumber, ...attempt })
    }
    await reevaluateEventStatus(eventId, tx)
    return true
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

export type DeliveryTransportError =
  'timeout' | 'network_error' | 'blocked_url' | 'too_many_redirects'

export function isTerminalTransportError(
  error: DeliveryTransportError,
): error is 'blocked_url' | 'too_many_redirects' {
  return error === 'blocked_url' || error === 'too_many_redirects'
}

export function classifyDeliveryError(err: unknown): DeliveryTransportError {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'timeout'
    if (err.message.startsWith('blocked_url')) return 'blocked_url'
    if (err.message === 'too_many_redirects') return 'too_many_redirects'
  }
  return 'network_error'
}

/** Claim a pending delivery so only one worker proceeds to HTTP. */
async function claimPendingDelivery(deliveryId: string): Promise<Date | null> {
  const db = getDb()
  const leaseStartedAt = new Date()
  const [claimed] = await db
    .update(deliveries)
    .set({ status: 'in_progress', updatedAt: leaseStartedAt })
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.status, 'pending')))
    .returning({ updatedAt: deliveries.updatedAt })
  return claimed?.updatedAt ?? null
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

  const leaseStartedAt = await claimPendingDelivery(row.id)
  if (!leaseStartedAt) {
    log.info('claim_lost')
    return
  }

  if (row.endpointStatus === 'disabled') {
    await recordOutcome(
      row.id,
      row.eventId,
      leaseStartedAt,
      {
        status: 'failed',
        attemptCount: row.attemptCount + 1,
        lastError: 'endpoint_disabled',
        nextRetryAt: null,
      },
      { error: 'endpoint_disabled' },
    )
    log.info('endpoint_disabled')
    return
  }

  const allowPrivate = env.NODE_ENV !== 'production'
  if (row.attemptCount >= env.MAX_DELIVERY_ATTEMPTS) {
    await recordOutcome(row.id, row.eventId, leaseStartedAt, {
      status: 'failed',
      lastError: 'max_attempts',
      nextRetryAt: null,
    })
    log.info('max_attempts')
    return
  }

  const allowed = await takeRateLimitToken(row.tenantId)
  if (!allowed) {
    const retryAt = new Date(Date.now() + RATE_LIMIT_DEFER_MS)
    const wrote = await recordOutcome(row.id, row.eventId, leaseStartedAt, {
      status: 'pending',
      lastError: 'rate_limited',
      nextRetryAt: retryAt,
    })
    if (!wrote) return
    await job.moveToDelayed(retryAt.getTime(), token)
    log.info('rate_limited')
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

  const start = Date.now()
  const attemptCountAfterHttp = row.attemptCount + 1
  let httpStatus: number | null = null
  let responseBody: string | null = null
  let error: DeliveryTransportError | null = null

  try {
    const result = await postWithTimeout(
      row.url,
      body,
      headers,
      env.DELIVERY_TIMEOUT_MS,
      allowPrivate,
    )
    httpStatus = result.status
    responseBody = result.body
  } catch (err) {
    error = classifyDeliveryError(err)
    log.info({ error }, 'delivery_transport_failure')
  }

  if (error !== null && isTerminalTransportError(error)) {
    await recordOutcome(
      row.id,
      row.eventId,
      leaseStartedAt,
      {
        attemptCount: row.attemptCount + 1,
        status: 'failed',
        lastError: error,
        nextRetryAt: null,
      },
      { httpStatus, responseBody, error, durationMs: Date.now() - start },
    )
    log.info({ last_error: error }, 'delivery_failed_fast')
    return
  }

  if (httpStatus !== null) {
    if (httpStatus >= 200 && httpStatus < 300) {
      await recordOutcome(
        row.id,
        row.eventId,
        leaseStartedAt,
        {
          attemptCount: row.attemptCount + 1,
          status: 'succeeded',
          lastError: null,
          nextRetryAt: null,
        },
        { httpStatus, responseBody, durationMs: Date.now() - start },
      )
      log.info({ http_status: httpStatus }, 'delivery_succeeded')
      return
    }

    log.info({ http_status: httpStatus }, 'delivery_http_failure')

    if (!isRetryableHttpStatus(httpStatus)) {
      await recordOutcome(
        row.id,
        row.eventId,
        leaseStartedAt,
        {
          attemptCount: row.attemptCount + 1,
          status: 'failed',
          lastError: `http_${httpStatus}`,
          nextRetryAt: null,
        },
        { httpStatus, responseBody, error: null, durationMs: Date.now() - start },
      )
      log.info({ last_error: `http_${httpStatus}` }, 'delivery_failed_fast')
      return
    }
  }

  const attempt: HttpAttemptFields = {
    httpStatus,
    responseBody,
    error,
    durationMs: Date.now() - start,
  }

  if (attemptCountAfterHttp >= env.MAX_DELIVERY_ATTEMPTS) {
    await recordOutcome(
      row.id,
      row.eventId,
      leaseStartedAt,
      {
        attemptCount: row.attemptCount + 1,
        status: 'failed',
        lastError: 'max_attempts',
        nextRetryAt: null,
      },
      attempt,
    )
    log.info({ attempt_count: attemptCountAfterHttp }, 'delivery_dead_letter')
    return
  }

  const lastError = error ?? `http_${httpStatus}`
  const retryAt = new Date(Date.now() + calculateBackoffDelayMs(attemptCountAfterHttp))
  const wrote = await recordOutcome(
    row.id,
    row.eventId,
    leaseStartedAt,
    {
      attemptCount: row.attemptCount + 1,
      status: 'pending',
      lastError,
      nextRetryAt: retryAt,
    },
    attempt,
  )
  if (!wrote) return
  await job.moveToDelayed(retryAt.getTime(), token)
  log.info({ last_error: lastError, attempt_count: attemptCountAfterHttp }, 'delivery_retrying')
  throw new DelayedError()
}
