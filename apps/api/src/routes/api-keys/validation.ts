import { AppError } from '../../lib/errors.js'
import { requireUuid } from '../../lib/validation.js'

export type ApiKeyStatus = 'active' | 'revoked'

export function parseApiKeyId(id: string): void {
  requireUuid(id, 'API key not found')
}

export function parseListQuery(query: { status?: string | string[] }): { status?: ApiKeyStatus } {
  const status = Array.isArray(query.status) ? query.status[0] : query.status
  if (status === undefined || status === 'active' || status === 'revoked') return { status }
  throw new AppError(400, 'validation_error', 'Invalid status filter')
}
