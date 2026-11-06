import { AppError } from '../lib/errors.js'

export function missingSessionError(): AppError {
  return new AppError(401, 'unauthorized', 'Missing or invalid session')
}

export function missingTenantAuthError(): AppError {
  return new AppError(401, 'unauthorized', 'Missing or invalid Bearer token or session')
}
