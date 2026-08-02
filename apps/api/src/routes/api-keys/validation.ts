import { requireUuid } from '../../lib/validation.js'

export function parseApiKeyId(id: string): void {
  requireUuid(id, 'API key not found')
}
