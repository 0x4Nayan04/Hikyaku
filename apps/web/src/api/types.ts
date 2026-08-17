import type { DeliveryStatus, EndpointStatus, EventStatus } from '@webhook/shared/constants'
export type { DeliveryStatus, EndpointStatus, EventStatus }

export type ApiErrorBody = {
  error?: {
    code?: string
    message?: string
  }
}

export type PaginationParams = {
  limit?: number
  offset?: number
}

export type ListEndpointsParams = PaginationParams & {
  status?: EndpointStatus
}

export type Paginated<T> = {
  data: T[]
  has_more: boolean
  limit: number
  offset: number
}

export type User = {
  id: string
  email: string
  name: string
  is_super_admin: boolean
}

export type Tenant = {
  id: string
  name: string
}

export type MeResponse = {
  user: User
  tenant: Tenant | null
}

export type CreateInviteResponse = {
  invite_url: string
  expires_at: string
}

export type ValidateInviteResponse = {
  kind: 'tenant_owner' | 'tenant_user'
  email: string
  tenant_name: string | null
  invited_name: string | null
  expires_at: string
}

export type AdminTenant = {
  id: string
  name: string
  created_at: string
}

export type EndpointLastDelivery = {
  id: string
  status: DeliveryStatus
  updated_at: string
  last_error: string | null
}

export type Endpoint = {
  id: string
  url: string
  status: EndpointStatus
  description: string | null
  created_at: string
  last_delivery?: EndpointLastDelivery | null
}

export type EndpointWithSecret = Endpoint & {
  secret: string
}

export type EventSummary = {
  id: string
  idempotency_key: string
  type: string
  status: EventStatus
  created_at: string
}

export type DeliveriesSummary = {
  total: number
  succeeded: number
  failed: number
  pending: number
}

export type EventDetail = {
  id: string
  idempotency_key: string
  type: string
  payload: Record<string, unknown>
  status: EventStatus
  created_at: string
  deliveries_summary: DeliveriesSummary
}

export type IngestEventResponse = {
  id: string
  status: EventStatus
  created_at: string
}

export type Delivery = {
  id: string
  event_id: string
  endpoint_id: string
  endpoint_url: string
  status: DeliveryStatus
  attempt_count: number
  next_retry_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export type DeliveryAttempt = {
  attempt_number: number
  http_status: number | null
  response_body: string | null
  error: string | null
  duration_ms: number | null
  created_at: string
}

export type DeliveryDetail = Delivery & {
  attempts: DeliveryAttempt[]
}

export type ListDeliveriesParams = PaginationParams & {
  status?: DeliveryStatus
  event_id?: string
}

export type ReplayDeliveryResponse = {
  id: string
  status: 'pending'
}

export type Stats = {
  events_today: number
  deliveries_active: number
  deliveries_succeeded_24h: number
  deliveries_failed_24h: number
  success_rate_24h: number | null
}

export type ApiKey = {
  id: string
  prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export type ApiKeyWithSecret = ApiKey & {
  api_key: string
}

export type ListApiKeysParams = PaginationParams & {
  status?: 'active' | 'revoked'
}
