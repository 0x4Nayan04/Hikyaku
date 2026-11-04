import { AppError } from '../../lib/errors.js'
import { queryString, requireUuid } from '../../lib/validation.js'

type ApiKeyStatus = 'active' | 'revoked'

export function parseApiKeyId(id: string): void {
  requireUuid(id, 'API key not found')
}

export function parseListQuery(query: { status?: unknown }): { status?: ApiKeyStatus } {
  const status = queryString(query.status, 'status')
  if (status === undefined || status === 'active' || status === 'revoked') return { status }
  throw new AppError(400, 'validation_error', 'Invalid status filter')
}
