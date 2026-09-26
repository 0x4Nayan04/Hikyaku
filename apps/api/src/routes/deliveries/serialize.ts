import type {
  DeliveryAttemptJson,
  DeliveryDetailJson,
  DeliveryListJson,
} from '@webhook/shared/apiJson'
import type { DeliveryStatus } from '@webhook/shared/constants'

type DeliveryRow = {
  id: string
  eventId: string
  endpointId: string
  endpointUrl: string
  status: DeliveryStatus
  replayCount: number
  attemptCount: number
  nextRetryAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

type AttemptRow = {
  runNumber: number
  attemptNumber: number
  httpStatus: number | null
  responseBody: string | null
  error: string | null
  durationMs: number | null
  createdAt: Date
}

export function toDeliveryListJson(row: DeliveryRow): DeliveryListJson {
  return {
    id: row.id,
    event_id: row.eventId,
    endpoint_id: row.endpointId,
    endpoint_url: row.endpointUrl,
    status: row.status,
    attempt_count: row.attemptCount,
    replay_count: row.replayCount,
    next_retry_at: row.nextRetryAt?.toISOString() ?? null,
    last_error: row.lastError,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

function toAttemptJson(row: AttemptRow): DeliveryAttemptJson {
  return {
    attempt_number: row.attemptNumber,
    run_number: row.runNumber,
    http_status: row.httpStatus,
    response_body: row.responseBody,
    error: row.error,
    duration_ms: row.durationMs,
    created_at: row.createdAt.toISOString(),
  }
}

export function toDeliveryDetailJson(row: DeliveryRow, attempts: AttemptRow[]): DeliveryDetailJson {
  return {
    ...toDeliveryListJson(row),
    attempts: attempts.map((attempt) => toAttemptJson(attempt)),
  }
}
