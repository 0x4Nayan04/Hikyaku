import type { DeliveryStatus, EndpointStatus, EventStatus } from '@webhook/shared/constants'
import type {
  DeliveriesSummary,
  DeliveryAttemptJson,
  DeliveryDetailJson,
  DeliveryListJson,
  EndpointJson,
  EndpointLastDeliveryJson,
  EndpointWithSecretJson,
  EventDetailJson,
  EventListJson,
  IngestEventJson,
  ReplayDeliveryJson,
} from '@webhook/shared/apiJson'

export type { DeliveryStatus, EndpointStatus, EventStatus }
export type {
  DeliveriesSummary,
  ReplayDeliveryJson as ReplayDeliveryResponse,
}

export type EventSummary = EventListJson
export type EventDetail = EventDetailJson
export type IngestEventResponse = IngestEventJson
export type Delivery = DeliveryListJson
export type DeliveryAttempt = DeliveryAttemptJson
export type DeliveryDetail = DeliveryDetailJson
export type Endpoint = EndpointJson
export type EndpointWithSecret = EndpointWithSecretJson
export type EndpointLastDelivery = EndpointLastDeliveryJson

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

export type ListEventsParams = PaginationParams & {
  status?: EventStatus
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
  tenant_id?: string | null
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
  kind: 'tenant_owner' | 'tenant_user' | 'password_reset'
  email: string
  tenant_name: string | null
  invited_name: string | null
  expires_at: string
}

export type PasswordResetLinkResponse = {
  reset_url: string
  expires_at: string
}

export type ValidatePasswordResetResponse = {
  email: string
  expires_at: string
}

export type AdminTenant = {
  id: string
  name: string
  created_at: string
}

export type ListDeliveriesParams = PaginationParams & {
  status?: DeliveryStatus
  event_id?: string
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
