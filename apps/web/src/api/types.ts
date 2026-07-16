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

export type Paginated<T> = {
  data: T[]
  total: number
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

export type BootstrapInput = {
  email: string
  password: string
  name: string
}

export type LoginInput = {
  email: string
  password: string
}

export type ChangePasswordInput = {
  current_password: string
  new_password: string
}

export type AdminCreateTenantInput = {
  tenant_name: string
  owner_email: string
  owner_password: string
  owner_name: string
}

export type AdminCreateUserInput = {
  email: string
  password: string
  name: string
}

export type AdminCreateTenantOwnerInviteInput = {
  kind: 'tenant_owner'
  tenant_name: string
  owner_email: string
  owner_name?: string
}

export type AdminCreateTenantUserInviteInput = {
  kind: 'tenant_user'
  tenant_id: string
  email: string
  name?: string
}

export type AdminCreateInviteInput =
  | AdminCreateTenantOwnerInviteInput
  | AdminCreateTenantUserInviteInput

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

export type AcceptInviteInput = {
  token: string
  name: string
  password: string
}

export type SignupRequestInput = {
  tenant_name: string
  email: string
  name: string
  password: string
}

export type SignupRequestStatus = 'pending' | 'approved' | 'rejected'

export type SignupRequest = {
  id: string
  tenant_name: string
  email: string
  name: string
  status: SignupRequestStatus
  created_at: string
}

export type AdminTenant = {
  id: string
  name: string
  created_at: string
}

export type EndpointStatus = 'active' | 'disabled'

export type Endpoint = {
  id: string
  url: string
  status: EndpointStatus
  description: string | null
  created_at: string
}

export type EndpointWithSecret = Endpoint & {
  secret: string
}

export type CreateEndpointInput = {
  url: string
  description?: string
}

export type PatchEndpointInput = {
  status?: EndpointStatus
  description?: string
}

export type EventStatus = 'pending' | 'completed' | 'failed'

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
  deferred: number
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

export type IngestEventInput = {
  idempotency_key: string
  type: string
  payload: Record<string, unknown>
}

export type IngestEventResponse = {
  id: string
  status: EventStatus
  created_at: string
}

export type DeliveryStatus = 'pending' | 'in_progress' | 'succeeded' | 'failed' | 'deferred'

export type Delivery = {
  id: string
  event_id: string
  endpoint_id: string
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
}

export type ReplayDeliveryResponse = {
  id: string
  status: 'pending'
}

export type Stats = {
  events_today: number
  deliveries_active: number
  deliveries_deferred: number
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

export type AuditLogEntry = {
  id: string
  action: string
  actor_id: string | null
  tenant_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type ApiKeyWithSecret = ApiKey & {
  api_key: string
}
