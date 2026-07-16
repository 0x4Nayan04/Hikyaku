export type DeliveryRow = {
  id: string
  eventId: string
  endpointId: string
  endpointUrl: string
  status: string
  attemptCount: number
  nextRetryAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

export type AttemptRow = {
  attemptNumber: number
  httpStatus: number | null
  responseBody: string | null
  error: string | null
  durationMs: number | null
  createdAt: Date
}

export function toDeliveryListJson(row: DeliveryRow) {
  return {
    id: row.id,
    event_id: row.eventId,
    endpoint_id: row.endpointId,
    endpoint_url: row.endpointUrl,
    status: row.status,
    attempt_count: row.attemptCount,
    next_retry_at: row.nextRetryAt?.toISOString() ?? null,
    last_error: row.lastError,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

export function toAttemptJson(row: AttemptRow) {
  return {
    attempt_number: row.attemptNumber,
    http_status: row.httpStatus,
    response_body: row.responseBody,
    error: row.error,
    duration_ms: row.durationMs,
    created_at: row.createdAt.toISOString(),
  }
}

export function toDeliveryDetailJson(row: DeliveryRow, attempts: AttemptRow[]) {
  return {
    ...toDeliveryListJson(row),
    attempts: attempts.map((attempt) => toAttemptJson(attempt)),
  }
}
