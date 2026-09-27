import type { DeliveryStatus, EndpointStatus, EventStatus } from './constants.js'

export type DeliveriesSummary = {
  total: number
  succeeded: number
  failed: number
  pending: number
}

export type IngestEventJson = {
  id: string
  status: EventStatus
  created_at: string
}

export type EventListJson = {
  id: string
  idempotency_key: string
  type: string
  status: EventStatus
  created_at: string
}

export type EventDetailJson = EventListJson & {
  payload: unknown
  deliveries_summary: DeliveriesSummary
}

export type DeliveryListJson = {
  id: string
  event_id: string
  endpoint_id: string
  endpoint_url: string
  status: DeliveryStatus
  replay_count: number
  attempt_count: number
  next_retry_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export type DeliveryAttemptJson = {
  run_number: number
  attempt_number: number
  http_status: number | null
  response_body: string | null
  error: string | null
  duration_ms: number | null
  created_at: string
}

export type DeliveryDetailJson = DeliveryListJson & {
  endpoint_status: EndpointStatus
  attempts: DeliveryAttemptJson[]
}

export type ReplayDeliveryJson = {
  id: string
  status: Extract<DeliveryStatus, 'pending'>
}

export type EndpointLastDeliveryJson = {
  id: string
  status: DeliveryStatus
  updated_at: string
  last_error: string | null
}

export type EndpointJson = {
  id: string
  url: string
  status: EndpointStatus
  description: string | null
  created_at: string
  last_delivery?: EndpointLastDeliveryJson | null
}

export type EndpointWithSecretJson = EndpointJson & {
  secret: string
}
