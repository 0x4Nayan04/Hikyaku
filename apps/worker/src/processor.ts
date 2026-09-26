import {
  ENDPOINT_STATUSES,
  type DeliveryJobData,
  type EndpointStatus,
} from '@webhook/shared/constants'
import { signPayload } from '@webhook/shared/crypto'
import { reevaluateEventStatus } from '@webhook/shared/eventStatus'
import { deliveryAttempts, deliveries } from '@webhook/shared/schema'
import { DelayedError, type Job } from 'bullmq'
import { and, eq, sql } from 'drizzle-orm'
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
  replayCount: number
  attemptCount: number
  eventType: string
  eventPayload: unknown
  eventCreatedAt: Date
  url: string
  secret: string
  endpointStatus: EndpointStatus
}

type ClaimRow = {
  id: string
  tenant_id: string
  event_id: string
  replay_count: number
  attempt_count: number
  event_type: string
  event_payload: unknown
  event_created_at: Date
  url: string
  secret: string
  endpoint_status: string
}

type HttpAttemptFields = {
  httpStatus: number | null
  responseBody: string | null
  error: string | null
  durationMs: number
}

type AttemptOutcome = Partial<HttpAttemptFields>

type DeliveryOutcome = {
  status: 'succeeded' | 'failed' | 'pending'
  attemptCount?: number
  lastError?: string | null
  nextRetryAt?: Date | null
}

type OutcomeDecision =
  | {
      action: 'fail_fast'
      lastError: string
      attemptCount?: number
      attempt?: AttemptOutcome
      log: string
      logFields?: Record<string, unknown>
    }
  | { action: 'succeeded'; attempt: AttemptOutcome; httpStatus: number }
  | { action: 'retry'; lastError: string; attempt: HttpAttemptFields; retryAt: Date }

function parseEndpointStatus(value: string): EndpointStatus {
  for (const status of ENDPOINT_STATUSES) {
    if (status === value) return status
  }
  throw new Error(`unexpected_endpoint_status:${value}`)
}

function toDeliveryContext(raw: ClaimRow): DeliveryContext {
  return {
    id: raw.id,
    tenantId: raw.tenant_id,
    eventId: raw.event_id,
    attemptCount: Number(raw.attempt_count),
    replayCount: Number(raw.replay_count),
    eventType: raw.event_type,
    eventPayload: raw.event_payload,
    eventCreatedAt: new Date(raw.event_created_at),
    url: raw.url,
    secret: raw.secret,
    endpointStatus: parseEndpointStatus(raw.endpoint_status),
  }
}

async function recordOutcome(
  deliveryId: string,
  eventId: string,
  leaseStartedAt: Date,
  runNumber: number,
  delivery: DeliveryOutcome,
  attempt?: AttemptOutcome,
  attemptNumber?: number,
): Promise<boolean> {
  const db = getDb()

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
          eq(deliveries.replayCount, runNumber),
        ),
      )
      .returning({ id: deliveries.id })

    if (!updated) {
      logger.info({ delivery_id: deliveryId }, 'outcome_lease_lost')
      return false
    }

    if (attempt && attemptNumber !== undefined) {
      await tx.insert(deliveryAttempts).values({ deliveryId, runNumber, attemptNumber, ...attempt })
    }

    switch (delivery.status) {
      case 'pending':
        break
      case 'succeeded':
      case 'failed':
        await reevaluateEventStatus(eventId, tx)
        break
      default: {
        const _exhaustive: never = delivery.status
        throw new Error(`unexpected delivery status: ${_exhaustive}`)
      }
    }
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

type DeliveryTransportError = 'timeout' | 'network_error' | 'blocked_url' | 'too_many_redirects'

function isTerminalTransportError(
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

/** Old jobs may only have deliveryId. Look up tenant so rate-limit still runs before claim. */
async function resolveJobTenantId(
  deliveryId: string,
  tenantId: string | undefined,
): Promise<string | undefined> {
  if (tenantId) return tenantId
  const [row] = await getDb()
    .select({ tenantId: deliveries.tenantId })
    .from(deliveries)
    .where(eq(deliveries.id, deliveryId))
    .limit(1)
  return row?.tenantId
}

async function claimPendingDelivery(
  deliveryId: string,
): Promise<{ row: DeliveryContext; leaseStartedAt: Date } | null> {
  const db = getDb()
  const leaseStartedAt = new Date()
  const result = (await db.execute(sql`
    UPDATE deliveries AS d
    SET status = 'in_progress', updated_at = ${leaseStartedAt}
    FROM events AS e, endpoints AS ep
    WHERE d.id = ${deliveryId}
      AND d.status = 'pending'
      AND e.id = d.event_id
      AND ep.id = d.endpoint_id
    RETURNING
      d.id,
      d.tenant_id,
      d.event_id,
      d.attempt_count,
      d.replay_count,
      e.type AS event_type,
      e.payload AS event_payload,
      e.created_at AS event_created_at,
      ep.url,
      ep.secret,
      ep.status AS endpoint_status
  `)) as { rows: ClaimRow[] }

  const raw = result.rows[0]
  if (!raw) return null
  return { row: toDeliveryContext(raw), leaseStartedAt }
}

export async function processor(job: Job<DeliveryJobData>, token?: string): Promise<void> {
  const { deliveryId } = job.data
  const log = logger.child({ delivery_id: deliveryId })
  const tenantId = await resolveJobTenantId(deliveryId, job.data.tenantId)

  if (tenantId) {
    const decision = await takeRateLimitToken(tenantId)
    if (!decision.allowed) {
      await job.moveToDelayed(decision.retryAt.getTime(), token)
      log.info('rate_limited')
      throw new DelayedError()
    }
  }

  const claimed = await claimPendingDelivery(deliveryId)
  if (!claimed) {
    log.info('claim_lost')
    return
  }

  const { row, leaseStartedAt } = claimed
  const nextAttempt = row.attemptCount + 1

  let decision: OutcomeDecision

  if (row.endpointStatus === 'disabled') {
    decision = {
      action: 'fail_fast',
      lastError: 'endpoint_disabled',
      attemptCount: nextAttempt,
      attempt: { error: 'endpoint_disabled' },
      log: 'endpoint_disabled',
    }
  } else if (row.attemptCount >= env.MAX_DELIVERY_ATTEMPTS) {
    decision = { action: 'fail_fast', lastError: 'max_attempts', log: 'max_attempts' }
  } else {
    const allowPrivate = env.NODE_ENV !== 'production'
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

    const durationMs = Date.now() - start

    if (error !== null && isTerminalTransportError(error)) {
      decision = {
        action: 'fail_fast',
        lastError: error,
        attemptCount: nextAttempt,
        attempt: { httpStatus, responseBody, error, durationMs },
        log: 'delivery_failed_fast',
        logFields: { last_error: error },
      }
    } else if (httpStatus !== null && httpStatus >= 200 && httpStatus < 300) {
      decision = {
        action: 'succeeded',
        attempt: { httpStatus, responseBody, durationMs },
        httpStatus,
      }
    } else {
      if (httpStatus !== null) {
        log.info({ http_status: httpStatus }, 'delivery_http_failure')
      }

      if (httpStatus !== null && !isRetryableHttpStatus(httpStatus)) {
        decision = {
          action: 'fail_fast',
          lastError: `http_${httpStatus}`,
          attemptCount: nextAttempt,
          attempt: { httpStatus, responseBody, error: null, durationMs },
          log: 'delivery_failed_fast',
          logFields: { last_error: `http_${httpStatus}` },
        }
      } else {
        const attempt: HttpAttemptFields = { httpStatus, responseBody, error, durationMs }
        if (nextAttempt >= env.MAX_DELIVERY_ATTEMPTS) {
          decision = {
            action: 'fail_fast',
            lastError: 'max_attempts',
            attemptCount: nextAttempt,
            attempt,
            log: 'delivery_dead_letter',
            logFields: { attempt_count: nextAttempt },
          }
        } else {
          decision = {
            action: 'retry',
            lastError: error ?? `http_${httpStatus}`,
            attempt,
            retryAt: new Date(Date.now() + calculateBackoffDelayMs(nextAttempt)),
          }
        }
      }
    }
  }

  const attempt = decision.attempt
  const persist = (delivery: DeliveryOutcome) =>
    recordOutcome(
      row.id,
      row.eventId,
      leaseStartedAt,
      row.replayCount,
      delivery,
      attempt,
      attempt !== undefined ? nextAttempt : undefined,
    )

  switch (decision.action) {
    case 'succeeded':
      await persist({
        status: 'succeeded',
        attemptCount: nextAttempt,
        lastError: null,
        nextRetryAt: null,
      })
      log.info({ http_status: decision.httpStatus }, 'delivery_succeeded')
      return
    case 'fail_fast':
      await persist({
        status: 'failed',
        lastError: decision.lastError,
        nextRetryAt: null,
        ...(decision.attemptCount !== undefined ? { attemptCount: decision.attemptCount } : {}),
      })
      if (decision.logFields) log.info(decision.logFields, decision.log)
      else log.info(decision.log)
      return
    case 'retry': {
      const wrote = await persist({
        status: 'pending',
        attemptCount: nextAttempt,
        lastError: decision.lastError,
        nextRetryAt: decision.retryAt,
      })
      if (!wrote) return
      await job.moveToDelayed(decision.retryAt.getTime(), token)
      log.info({ last_error: decision.lastError, attempt_count: nextAttempt }, 'delivery_retrying')
      throw new DelayedError()
    }
    default: {
      const _exhaustive: never = decision
      throw new Error(`unexpected decision: ${_exhaustive}`)
    }
  }
}
