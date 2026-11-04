import type { DeliveryJobData } from '@hikyaku/shared/constants/queue'
import { signPayload } from '@hikyaku/shared/crypto'
import { reevaluateEventStatus } from '@hikyaku/shared/eventStatus'
import { deliveryAttempts, deliveries } from '@hikyaku/shared/schema'
import { DelayedError, type Job } from 'bullmq'
import { and, eq, sql } from 'drizzle-orm'
import { calculateBackoffDelayMs } from './backoff.js'
import { env } from './config.js'
import { getDb } from './db/client.js'
import { postWithTimeout, WebhookTransportError } from './httpClient.js'
import { parseClaimResult, type DeliveryContext } from './claimRow.js'
import { logger } from './lib/logger.js'
import { takeRateLimitToken } from './rateLimit.js'

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
      action: 'failed'
      lastError: string
      attempt: AttemptOutcome
      log: string
      logFields?: Record<string, unknown>
    }
  | { action: 'succeeded'; attempt: AttemptOutcome; httpStatus: number }
  | { action: 'retry'; lastError: string; attempt: HttpAttemptFields; retryAt: Date }

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
    if (err instanceof WebhookTransportError) {
      return err.kind === 'dns_error' ? 'network_error' : err.kind
    }
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
): Promise<{ row: DeliveryContext; leaseStartedAt: Date; reservedAttempt: number | null } | null> {
  const db = getDb()
  const leaseStartedAt = new Date()
  const maxAttempts = env.MAX_DELIVERY_ATTEMPTS
  const result: unknown = await db.execute(sql`
    WITH target AS (
      SELECT d.id, d.attempt_count AS previous_attempt_count
      FROM deliveries AS d
      WHERE d.id = ${deliveryId}
        AND d.status = 'pending'
        AND (d.next_retry_at IS NULL OR d.next_retry_at <= NOW())
      FOR UPDATE
    )
    UPDATE deliveries AS d
    SET
      status = 'in_progress',
      attempt_count = CASE
        WHEN target.previous_attempt_count < ${maxAttempts} THEN target.previous_attempt_count + 1
        ELSE target.previous_attempt_count
      END,
      updated_at = ${leaseStartedAt}
    FROM target, events AS e, endpoints AS ep
    WHERE d.id = target.id
      AND e.id = d.event_id
      AND ep.id = d.endpoint_id
    RETURNING
      d.id,
      d.tenant_id,
      d.event_id,
      d.attempt_count,
      d.replay_count,
      target.previous_attempt_count,
      e.type AS event_type,
      e.payload AS event_payload,
      e.created_at AS event_created_at,
      ep.url,
      ep.secret,
      ep.status AS endpoint_status
  `)

  const claimed = parseClaimResult(result)
  if (!claimed) return null
  const { row, previousAttemptCount } = claimed
  return {
    row,
    leaseStartedAt,
    reservedAttempt: previousAttemptCount < maxAttempts ? row.attemptCount : null,
  }
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

  const { row, leaseStartedAt, reservedAttempt } = claimed

  const persist = (delivery: DeliveryOutcome, attempt?: AttemptOutcome, attemptNumber?: number) =>
    recordOutcome(
      row.id,
      row.eventId,
      leaseStartedAt,
      row.replayCount,
      delivery,
      attempt,
      attemptNumber,
    )

  if (reservedAttempt === null) {
    await persist({
      status: 'failed',
      lastError: 'max_attempts',
      nextRetryAt: null,
    })
    log.info('max_attempts')
    return
  }

  let decision: OutcomeDecision

  if (row.endpointStatus === 'disabled') {
    decision = {
      action: 'failed',
      lastError: 'endpoint_disabled',
      attempt: { error: 'endpoint_disabled' },
      log: 'endpoint_disabled',
    }
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
      log.info({ error, err }, 'delivery_transport_failure')
    }

    const durationMs = Date.now() - start

    if (error !== null && isTerminalTransportError(error)) {
      decision = {
        action: 'failed',
        lastError: error,
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
          action: 'failed',
          lastError: `http_${httpStatus}`,
          attempt: { httpStatus, responseBody, error: null, durationMs },
          log: 'delivery_failed_fast',
          logFields: { last_error: `http_${httpStatus}` },
        }
      } else {
        const attempt: HttpAttemptFields = { httpStatus, responseBody, error, durationMs }
        if (reservedAttempt >= env.MAX_DELIVERY_ATTEMPTS) {
          decision = {
            action: 'failed',
            lastError: 'max_attempts',
            attempt,
            log: 'delivery_dead_letter',
            logFields: { attempt_count: reservedAttempt },
          }
        } else {
          decision = {
            action: 'retry',
            lastError: error ?? `http_${httpStatus}`,
            attempt,
            retryAt: new Date(Date.now() + calculateBackoffDelayMs(reservedAttempt)),
          }
        }
      }
    }
  }

  const attempt = decision.attempt

  switch (decision.action) {
    case 'succeeded': {
      const wrote = await persist(
        {
          status: 'succeeded',
          attemptCount: reservedAttempt,
          lastError: null,
          nextRetryAt: null,
        },
        attempt,
        reservedAttempt,
      )
      if (!wrote) return
      log.info({ http_status: decision.httpStatus }, 'delivery_succeeded')
      return
    }
    case 'failed': {
      const wrote = await persist(
        {
          status: 'failed',
          lastError: decision.lastError,
          nextRetryAt: null,
          attemptCount: reservedAttempt,
        },
        attempt,
        reservedAttempt,
      )
      if (!wrote) return
      if (decision.logFields) log.info(decision.logFields, decision.log)
      else log.info(decision.log)
      return
    }
    case 'retry': {
      const wrote = await persist(
        {
          status: 'pending',
          attemptCount: reservedAttempt,
          lastError: decision.lastError,
          nextRetryAt: decision.retryAt,
        },
        attempt,
        reservedAttempt,
      )
      if (!wrote) return
      await job.moveToDelayed(decision.retryAt.getTime(), token)
      log.info(
        { last_error: decision.lastError, attempt_count: reservedAttempt },
        'delivery_retrying',
      )
      throw new DelayedError()
    }
    default: {
      const _exhaustive: never = decision
      throw new Error(`unexpected decision: ${_exhaustive}`)
    }
  }
}
