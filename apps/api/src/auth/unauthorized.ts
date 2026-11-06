import { AppError } from '../lib/errors.js'

export const SESSION_UNAUTHORIZED_MESSAGE = 'Missing or invalid session'
export const TENANT_UNAUTHORIZED_MESSAGE = 'Missing or invalid Bearer token or session'

export function unauthorizedSession(): AppError {
  return new AppError(401, 'unauthorized', SESSION_UNAUTHORIZED_MESSAGE)
}

export function unauthorizedTenantAuth(): AppError {
  return new AppError(401, 'unauthorized', TENANT_UNAUTHORIZED_MESSAGE)
}
