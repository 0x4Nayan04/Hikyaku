import type {
  AcceptInviteInput,
  AdminCreateInviteInput,
  BootstrapInput,
  ChangePasswordInput,
  CreateEndpointInput,
  IngestEventInput,
  LoginInput,
  PasswordResetInput,
  PatchEndpointInput,
} from '@hikyaku/shared/zod'
import type {
  CreateInviteResponse,
  AdminTenant,
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
  ListEventsParams,
  Paginated,
  PaginationParams,
  PasswordResetLinkResponse,
  ReplayDeliveryResponse,
  Stats,
  User,
  MeResponse,
  ValidateInviteResponse,
  ValidatePasswordResetResponse,
} from './types'
import { getLoginPath } from '@/lib/auth/auth-redirect'

const configuredApiUrl = import.meta.env.VITE_API_URL
export const API_BASE =
  configuredApiUrl !== undefined
    ? configuredApiUrl
    : import.meta.env.DEV
      ? 'http://localhost:3000'
      : ''

/** Absolute API origin for curl samples and docs. The browser uses API_BASE, which stays same-origin on Vercel. */
export const PUBLIC_API_BASE = import.meta.env.VITE_PUBLIC_API_URL || API_BASE

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

function apiUrl(path: string): string {
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
    const body: unknown = await res.json()
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const detail = body.error
      if (typeof detail === 'object' && detail !== null) {
        if ('code' in detail && typeof detail.code === 'string') code = detail.code
        if ('message' in detail && typeof detail.message === 'string') message = detail.message
      }
    }
  } catch {
    // Response body was not JSON.
  }

  return new ApiError(res.status, code, message)
}

export function apiFetch(
  path: string,
  options: ApiFetchOptions & { responseType: 'empty' },
): Promise<void>
export function apiFetch<T>(
  path: string,
  options?: ApiFetchOptions & { responseType?: 'json' },
): Promise<T>
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions & { responseType?: 'json' | 'empty' } = {},
): Promise<T | void> {
  const { skipAuthRedirect: _skipAuthRedirect, responseType = 'json', headers, ...init } = options
  const requestHeaders = new Headers(headers)
  if (!requestHeaders.has('Content-Type')) requestHeaders.set('Content-Type', 'application/json')
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers: requestHeaders,
  })
  if (!res.ok) throw await parseErrorResponse(res)
  if (responseType === 'empty') return
  const text = await res.text()
  if (!text)
    throw new ApiError(res.status, 'invalid_response', 'Expected a JSON response from the server')
  return JSON.parse(text) as T
}

export function sessionApiFetch(
  path: string,
  options: ApiFetchOptions & { responseType: 'empty' },
): Promise<void>
export function sessionApiFetch<T>(
  path: string,
  options?: ApiFetchOptions & { responseType?: 'json' },
): Promise<T>
export async function sessionApiFetch<T>(
  path: string,
  options: ApiFetchOptions & { responseType?: 'json' | 'empty' } = {},
): Promise<T | void> {
  try {
    return options.responseType === 'empty'
      ? await apiFetch(path, { ...options, responseType: 'empty' })
      : await apiFetch<T>(path, { ...options, responseType: 'json' })
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      error.code === 'unauthorized' &&
      !options.skipAuthRedirect
    ) {
      window.location.assign(getLoginPath(window.location))
    }
    throw error
  }
}

export function getMe(options?: ApiFetchOptions): Promise<MeResponse> {
  return apiFetch('/v1/auth/me', { ...options, skipAuthRedirect: true })
}

export function getBootstrapStatus(): Promise<{ available: boolean }> {
  return sessionApiFetch('/v1/auth/bootstrap-status', { skipAuthRedirect: true })
}

export function bootstrap(
  adminSecret: string,
  body: BootstrapInput,
): Promise<{ user: Pick<User, 'id' | 'email' | 'is_super_admin'> }> {
  return sessionApiFetch('/v1/auth/bootstrap', {
    method: 'POST',
    skipAuthRedirect: true,
    headers: { 'X-Admin-Secret': adminSecret },
    body: JSON.stringify(body),
  })
}

export function login(body: LoginInput): Promise<{ user: User }> {
  return sessionApiFetch('/v1/auth/login', {
    method: 'POST',
    skipAuthRedirect: true,
    body: JSON.stringify(body),
  })
}

export function logout(): Promise<void> {
  return sessionApiFetch('/v1/auth/logout', {
    method: 'POST',
    skipAuthRedirect: true,
    responseType: 'empty',
  })
}

export function changePassword(body: ChangePasswordInput): Promise<void> {
  return sessionApiFetch('/v1/auth/change-password', {
    responseType: 'empty',
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getStats(options?: ApiFetchOptions): Promise<Stats> {
  return sessionApiFetch('/v1/stats', options)
}

export function listEndpoints(
  params: ListEndpointsParams = {},
  options?: ApiFetchOptions,
): Promise<Paginated<Endpoint>> {
  return sessionApiFetch(`/v1/endpoints${buildQuery(params)}`, options)
}

export function createEndpoint(body: CreateEndpointInput): Promise<EndpointWithSecret> {
  return sessionApiFetch('/v1/endpoints', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function patchEndpoint(id: string, body: PatchEndpointInput): Promise<Endpoint> {
  return sessionApiFetch(`/v1/endpoints/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function rotateEndpointSecret(id: string): Promise<EndpointWithSecret> {
  return sessionApiFetch(`/v1/endpoints/${id}/rotate`, { method: 'POST' })
}

export function listEvents(
  params: ListEventsParams = {},
  options?: ApiFetchOptions,
): Promise<Paginated<EventSummary>> {
  return sessionApiFetch(`/v1/events${buildQuery(params)}`, options)
}

export function getEvent(id: string, options?: ApiFetchOptions): Promise<EventDetail> {
  return sessionApiFetch(`/v1/events/${id}`, options)
}

export function sendEvent(body: IngestEventInput): Promise<IngestEventResponse> {
  return sessionApiFetch('/v1/events', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listDeliveries(
  params: ListDeliveriesParams = {},
  options?: ApiFetchOptions,
): Promise<Paginated<Delivery>> {
  return sessionApiFetch(`/v1/deliveries${buildQuery(params)}`, options)
}

export function getDelivery(id: string, options?: ApiFetchOptions): Promise<DeliveryDetail> {
  return sessionApiFetch(`/v1/deliveries/${id}`, options)
}

export function replayDelivery(id: string): Promise<ReplayDeliveryResponse> {
  return sessionApiFetch(`/v1/deliveries/${id}/replay`, { method: 'POST' })
}

export function listApiKeys(
  params: ListApiKeysParams = {},
  options?: ApiFetchOptions,
): Promise<Paginated<ApiKey>> {
  return sessionApiFetch(`/v1/api-keys${buildQuery(params)}`, options)
}

export function createApiKey(): Promise<ApiKeyWithSecret> {
  return sessionApiFetch('/v1/api-keys', { method: 'POST' })
}

export function revokeApiKey(id: string): Promise<ApiKey> {
  return sessionApiFetch(`/v1/api-keys/${id}/revoke`, { method: 'POST' })
}

export function rotateApiKey(id: string): Promise<ApiKeyWithSecret> {
  return sessionApiFetch(`/v1/api-keys/${id}/rotate`, { method: 'POST' })
}

export function listAdminTenants(
  params: PaginationParams & { search?: string } = {},
  options?: ApiFetchOptions,
): Promise<Paginated<AdminTenant>> {
  const { search, ...rest } = params
  return sessionApiFetch(`/v1/admin/tenants${buildQuery({ ...rest, search })}`, options)
}

export function getAdminTenant(id: string, options?: ApiFetchOptions): Promise<AdminTenant> {
  return sessionApiFetch(`/v1/admin/tenants/${id}`, options)
}

export function deleteAdminTenant(id: string): Promise<void> {
  return sessionApiFetch(`/v1/admin/tenants/${id}`, { method: 'DELETE', responseType: 'empty' })
}

export function patchAdminTenant(id: string, body: { tenant_name: string }): Promise<AdminTenant> {
  return sessionApiFetch(`/v1/admin/tenants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function listTenantUsers(
  tenantId: string,
  params: PaginationParams = {},
  options?: ApiFetchOptions,
): Promise<Paginated<User>> {
  return sessionApiFetch(`/v1/admin/tenants/${tenantId}/users${buildQuery(params)}`, options)
}

export function deleteAdminTenantUser(tenantId: string, userId: string): Promise<void> {
  return sessionApiFetch(`/v1/admin/tenants/${tenantId}/users/${userId}`, {
    method: 'DELETE',
    responseType: 'empty',
  })
}

export function createPasswordReset(
  tenantId: string,
  userId: string,
): Promise<PasswordResetLinkResponse> {
  return sessionApiFetch(`/v1/admin/tenants/${tenantId}/users/${userId}/reset-password`, {
    method: 'POST',
  })
}

export function createAdminInvite(body: AdminCreateInviteInput): Promise<CreateInviteResponse> {
  return sessionApiFetch('/v1/admin/invites', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function validateInvite(token: string): Promise<ValidateInviteResponse> {
  return sessionApiFetch(`/v1/auth/invites/validate${buildQuery({ token })}`, {
    skipAuthRedirect: true,
  })
}

export function acceptInvite(body: AcceptInviteInput): Promise<{ user: User }> {
  return sessionApiFetch('/v1/auth/accept-invite', {
    method: 'POST',
    skipAuthRedirect: true,
    body: JSON.stringify(body),
  })
}

export function validatePasswordReset(token: string): Promise<ValidatePasswordResetResponse> {
  return sessionApiFetch(`/v1/auth/password-reset/validate${buildQuery({ token })}`, {
    skipAuthRedirect: true,
  })
}

export function submitPasswordReset(body: PasswordResetInput): Promise<void> {
  return sessionApiFetch('/v1/auth/password-reset', {
    responseType: 'empty',
    method: 'POST',
    skipAuthRedirect: true,
    body: JSON.stringify(body),
  })
}

export function createMyWorkspace(body: {
  workspace_name: string
}): Promise<{ id: string; name: string }> {
  return sessionApiFetch('/v1/auth/workspace', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
