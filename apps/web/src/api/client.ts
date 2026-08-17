import type {
  AcceptInviteInput,
  AdminCreateInviteInput,
  BootstrapInput,
  ChangePasswordInput,
  CreateEndpointInput,
  IngestEventInput,
  LoginInput,
  PatchEndpointInput,
} from '@webhook/shared/zod'
import type {
  CreateInviteResponse,
  AdminTenant,
  ApiErrorBody,
  ApiKey,
  ApiKeyWithSecret,
  Delivery,
  DeliveryDetail,
  Endpoint,
  EndpointWithSecret,
  EventDetail,
  EventSummary,
  IngestEventResponse,
  ListApiKeysParams,
  ListDeliveriesParams,
  ListEndpointsParams,
  Paginated,
  PaginationParams,
  ReplayDeliveryResponse,
  Stats,
  User,
  ValidateInviteResponse,
} from './types'

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

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

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
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

  if (!res.ok) {
    const error = await parseErrorResponse(res)
    if (res.status === 401 && error.code === 'unauthorized' && !skipAuthRedirect) {
      window.location.assign('/login')
    }
    throw error
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

export function getBootstrapStatus(): Promise<{ available: boolean }> {
  return apiFetch('/v1/auth/bootstrap-status', { skipAuthRedirect: true })
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

export function getStats(options?: ApiFetchOptions): Promise<Stats> {
  return apiFetch('/v1/stats', options)
}

export function listEndpoints(
  params: ListEndpointsParams = {},
  options?: ApiFetchOptions,
): Promise<Paginated<Endpoint>> {
  return apiFetch(`/v1/endpoints${buildQuery(params)}`, options)
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

export function listEvents(
  params: PaginationParams = {},
  options?: ApiFetchOptions,
): Promise<Paginated<EventSummary>> {
  return apiFetch(`/v1/events${buildQuery(params)}`, options)
}

export function getEvent(id: string, options?: ApiFetchOptions): Promise<EventDetail> {
  return apiFetch(`/v1/events/${id}`, options)
}

export function sendEvent(body: IngestEventInput): Promise<IngestEventResponse> {
  return apiFetch('/v1/events', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listDeliveries(
  params: ListDeliveriesParams = {},
  options?: ApiFetchOptions,
): Promise<Paginated<Delivery>> {
  return apiFetch(`/v1/deliveries${buildQuery(params)}`, options)
}

export function getDelivery(id: string, options?: ApiFetchOptions): Promise<DeliveryDetail> {
  return apiFetch(`/v1/deliveries/${id}`, options)
}

export function replayDelivery(id: string): Promise<ReplayDeliveryResponse> {
  return apiFetch(`/v1/deliveries/${id}/replay`, { method: 'POST' })
}

export function listApiKeys(
  params: ListApiKeysParams = {},
  options?: ApiFetchOptions,
): Promise<Paginated<ApiKey>> {
  return apiFetch(`/v1/api-keys${buildQuery(params)}`, options)
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
  options?: ApiFetchOptions,
): Promise<Paginated<AdminTenant>> {
  const { search, ...rest } = params
  return apiFetch(`/v1/admin/tenants${buildQuery({ ...rest, search })}`, options)
}

export function getAdminTenant(id: string): Promise<AdminTenant> {
  return apiFetch(`/v1/admin/tenants/${id}`)
}

export function deleteAdminTenant(id: string): Promise<void> {
  return apiFetch(`/v1/admin/tenants/${id}`, { method: 'DELETE' })
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
  options?: ApiFetchOptions,
): Promise<Paginated<User>> {
  return apiFetch(`/v1/admin/tenants/${tenantId}/users${buildQuery(params)}`, options)
}

export function deleteAdminTenantUser(tenantId: string, userId: string): Promise<void> {
  return apiFetch(`/v1/admin/tenants/${tenantId}/users/${userId}`, { method: 'DELETE' })
}

export function createAdminInvite(body: AdminCreateInviteInput): Promise<CreateInviteResponse> {
  return apiFetch('/v1/admin/invites', {
    method: 'POST',
    body: JSON.stringify(body),
  })
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
