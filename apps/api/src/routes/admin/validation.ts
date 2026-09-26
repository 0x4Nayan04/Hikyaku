import { requireUuid } from '../../lib/validation.js'

export function parseTenantId(id: string): void {
  requireUuid(id, 'Tenant not found')
}

export function parseUserId(id: string): void {
  requireUuid(id, 'User not found')
}
