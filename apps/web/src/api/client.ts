import type {
  AcceptInviteInput,
  AdminCreateInviteInput,
  AdminCreateTenantInput,
  AdminCreateUserInput,
  AdminResetUserPasswordInput,
  AuditLogEntry,
  CreateInviteResponse,
  AdminTenant,
  ApiErrorBody,
  ApiKey,
  ApiKeyWithSecret,
  BootstrapInput,
  ChangePasswordInput,
  CreateEndpointInput,
  Delivery,
  DeliveryDetail,
  Endpoint,
  EndpointWithSecret,
  EventDetail,
  EventSummary,
  IngestEventInput,
  IngestEventResponse,
  ListDeliveriesParams,
  LoginInput,
  Paginated,
  PaginationParams,
  PatchEndpointInput,
  PlatformOperator,
  ReplayDeliveryResponse,
  SignupRequest,
  SignupRequestInput,
  Stats,
  User,
  ValidateInviteResponse,
} from './types'

const DEFAULT_BASE_URL = 'http://localhost:3000'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export type ApiFetchOptions = RequestInit & {
  skipAuthRedirect?: boolean
}

function getBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? DEFAULT_BASE_URL
}

export function apiUrl(path: string): string {
  return `${getBaseUrl()}${path}`
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value))
    }
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

async function parseErrorResponse(res: Response): Promise<ApiError> {
  let code = 'unknown'
  let message = res.statusText || 'Request failed'

  try {
    const body = (await res.json()) as ApiErrorBody
    if (body.error?.code) {
      code = body.error.code
    }
    if (body.error?.message) {
      message = body.error.message
    }
  } catch {
    // Response body was not JSON.
  }

  return new ApiError(res.status, code, message)
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuthRedirect, headers, ...init } = options

  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })

  if (res.status === 401 && !skipAuthRedirect) {
    window.location.assign('/login')
    throw await parseErrorResponse(res)
  }

  if (!res.ok) {
    throw await parseErrorResponse(res)
  }

  if (res.status === 204) {
    return undefined as T
  }

  const text = await res.text()
  if (!text) {
    return undefined as T
  }

  return JSON.parse(text) as T
}

export function bootstrap(
  adminSecret: string,
  body: BootstrapInput,
): Promise<{ user: Pick<User, 'id' | 'email' | 'is_super_admin'> }> {
  return apiFetch('/v1/auth/bootstrap', {
    method: 'POST',
    skipAuthRedirect: true,
    headers: { 'X-Admin-Secret': adminSecret },
    body: JSON.stringify(body),
  })
}

export function login(body: LoginInput): Promise<{ user: User }> {
  return apiFetch('/v1/auth/login', {
    method: 'POST',
    skipAuthRedirect: true,
    body: JSON.stringify(body),
  })
}

export function logout(): Promise<void> {
  return apiFetch('/v1/auth/logout', { method: 'POST' })
}

export function changePassword(body: ChangePasswordInput): Promise<void> {
  return apiFetch('/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getStats(): Promise<Stats> {
  return apiFetch('/v1/stats')
}

export function listEndpoints(params: PaginationParams = {}): Promise<Paginated<Endpoint>> {
  return apiFetch(`/v1/endpoints${buildQuery(params)}`)
}

export function createEndpoint(body: CreateEndpointInput): Promise<EndpointWithSecret> {
  return apiFetch('/v1/endpoints', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function patchEndpoint(id: string, body: PatchEndpointInput): Promise<Endpoint> {
  return apiFetch(`/v1/endpoints/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function listEvents(params: PaginationParams = {}): Promise<Paginated<EventSummary>> {
  return apiFetch(`/v1/events${buildQuery(params)}`)
}

export function getEvent(id: string): Promise<EventDetail> {
  return apiFetch(`/v1/events/${id}`)
}

export function sendEvent(body: IngestEventInput): Promise<IngestEventResponse> {
  return apiFetch('/v1/events', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listDeliveries(params: ListDeliveriesParams = {}): Promise<Paginated<Delivery>> {
  return apiFetch(`/v1/deliveries${buildQuery(params)}`)
}

export function getDelivery(id: string): Promise<DeliveryDetail> {
  return apiFetch(`/v1/deliveries/${id}`)
}

export function replayDelivery(id: string): Promise<ReplayDeliveryResponse> {
  return apiFetch(`/v1/deliveries/${id}/replay`, { method: 'POST' })
}

export function listApiKeys(): Promise<{ data: ApiKey[] }> {
  return apiFetch('/v1/api-keys')
}

export function createApiKey(): Promise<ApiKeyWithSecret> {
  return apiFetch('/v1/api-keys', { method: 'POST' })
}

export function revokeApiKey(id: string): Promise<ApiKey> {
  return apiFetch(`/v1/api-keys/${id}/revoke`, { method: 'POST' })
}

export function rotateApiKey(id: string): Promise<ApiKeyWithSecret> {
  return apiFetch(`/v1/api-keys/${id}/rotate`, { method: 'POST' })
}

export function listAdminTenants(
  params: PaginationParams & { search?: string } = {},
): Promise<Paginated<AdminTenant>> {
  const { search, ...rest } = params
  return apiFetch(`/v1/admin/tenants${buildQuery({ ...rest, search })}`)
}

export function getAdminTenant(id: string): Promise<AdminTenant> {
  return apiFetch(`/v1/admin/tenants/${id}`)
}

export function deleteAdminTenant(id: string): Promise<void> {
  return apiFetch(`/v1/admin/tenants/${id}`, { method: 'DELETE' })
}

export function suspendAdminTenant(id: string): Promise<AdminTenant> {
  return apiFetch(`/v1/admin/tenants/${id}/suspend`, { method: 'POST' })
}

export function unsuspendAdminTenant(id: string): Promise<AdminTenant> {
  return apiFetch(`/v1/admin/tenants/${id}/unsuspend`, { method: 'POST' })
}

export function patchAdminTenant(id: string, body: { tenant_name: string }): Promise<AdminTenant> {
  return apiFetch(`/v1/admin/tenants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function listTenantUsers(
  tenantId: string,
  params: PaginationParams = {},
): Promise<Paginated<User>> {
  return apiFetch(`/v1/admin/tenants/${tenantId}/users${buildQuery(params)}`)
}

export function createAdminTenant(
  body: AdminCreateTenantInput,
): Promise<{ tenant: AdminTenant; user: User }> {
  return apiFetch('/v1/admin/tenants', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function createAdminTenantUser(
  tenantId: string,
  body: AdminCreateUserInput,
): Promise<{ user: User }> {
  return apiFetch(`/v1/admin/tenants/${tenantId}/users`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function deleteAdminTenantUser(tenantId: string, userId: string): Promise<void> {
  return apiFetch(`/v1/admin/tenants/${tenantId}/users/${userId}`, { method: 'DELETE' })
}

export function resetAdminTenantUserPassword(
  tenantId: string,
  userId: string,
  body: AdminResetUserPasswordInput,
): Promise<void> {
  return apiFetch(`/v1/admin/tenants/${tenantId}/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function createAdminInvite(body: AdminCreateInviteInput): Promise<CreateInviteResponse> {
  return apiFetch('/v1/admin/invites', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listOperators(
  params: PaginationParams = {},
): Promise<Paginated<PlatformOperator>> {
  return apiFetch(`/v1/admin/operators${buildQuery(params)}`)
}

export function inviteOperator(body: {
  email: string
  name?: string
}): Promise<CreateInviteResponse> {
  return apiFetch('/v1/admin/operators/invites', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function deleteOperator(id: string): Promise<void> {
  return apiFetch(`/v1/admin/operators/${id}`, { method: 'DELETE' })
}

export function validateInvite(token: string): Promise<ValidateInviteResponse> {
  return apiFetch(`/v1/auth/invites/validate${buildQuery({ token })}`, {
    skipAuthRedirect: true,
  })
}

export function acceptInvite(body: AcceptInviteInput): Promise<{ user: User }> {
  return apiFetch('/v1/auth/accept-invite', {
    method: 'POST',
    skipAuthRedirect: true,
    body: JSON.stringify(body),
  })
}

export function createSignupRequest(
  body: SignupRequestInput,
): Promise<{ signupRequest: SignupRequest }> {
  return apiFetch('/v1/auth/signup', {
    method: 'POST',
    skipAuthRedirect: true,
    body: JSON.stringify(body),
  })
}

export function listAdminSignupRequests(
  params: PaginationParams & { status?: SignupRequest['status'] } = {},
): Promise<Paginated<SignupRequest>> {
  return apiFetch(`/v1/admin/signup-requests${buildQuery(params)}`)
}

export function approveAdminSignupRequest(
  id: string,
): Promise<{ signupRequest: SignupRequest; tenant: AdminTenant; user: User }> {
  return apiFetch(`/v1/admin/signup-requests/${id}/approve`, { method: 'POST' })
}

export function listAuditLog(
  params: PaginationParams & { action?: string } = {},
): Promise<Paginated<AuditLogEntry>> {
  const { action, ...rest } = params
  return apiFetch(`/v1/admin/audit-log${buildQuery({ ...rest, action })}`)
}

export function rejectAdminSignupRequest(id: string): Promise<{ signupRequest: SignupRequest }> {
  return apiFetch(`/v1/admin/signup-requests/${id}/reject`, { method: 'POST' })
}
