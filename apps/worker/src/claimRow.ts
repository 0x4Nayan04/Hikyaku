import { ENDPOINT_STATUSES, type EndpointStatus } from '@hikyaku/shared/constants/status'

export type DeliveryContext = {
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

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error('invalid_delivery_claim')
  return value as Record<string, unknown>
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('invalid_delivery_claim_string')
  return value
}

function counter(value: unknown): number {
  const parsed =
    typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))
      ? Number(value)
      : NaN
  if (!Number.isSafeInteger(parsed) || parsed < 0 || value === '') {
    throw new Error('invalid_delivery_claim_counter')
  }
  return parsed
}

export function parseClaimResult(result: unknown): {
  row: DeliveryContext
  previousAttemptCount: number
} | null {
  const rows: unknown = record(result).rows
  if (!Array.isArray(rows)) throw new Error('invalid_delivery_claim_rows')
  if (rows.length === 0) return null
  const raw = record(rows[0])
  const date = raw.event_created_at
  if (!(date instanceof Date) && typeof date !== 'string') {
    throw new Error('invalid_delivery_claim_date')
  }
  const eventCreatedAt = new Date(date)
  if (!Number.isFinite(eventCreatedAt.getTime())) throw new Error('invalid_delivery_claim_date')
  const endpointStatus = ENDPOINT_STATUSES.find((status) => status === raw.endpoint_status)
  if (!endpointStatus) throw new Error('invalid_delivery_claim_endpoint_status')
  return {
    previousAttemptCount: counter(raw.previous_attempt_count),
    row: {
      id: string(raw.id),
      tenantId: string(raw.tenant_id),
      eventId: string(raw.event_id),
      replayCount: counter(raw.replay_count),
      attemptCount: counter(raw.attempt_count),
      eventType: string(raw.event_type),
      eventPayload: raw.event_payload,
      eventCreatedAt,
      url: string(raw.url),
      secret: string(raw.secret),
      endpointStatus,
    },
  }
}
