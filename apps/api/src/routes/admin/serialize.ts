import type { TenantStatus } from '@webhook/shared/constants'

export type AdminTenantRow = {
  id: string
  name: string
  status: TenantStatus
  createdAt: Date
}

export function toAdminTenantJson(row: AdminTenantRow) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    created_at: row.createdAt.toISOString(),
  }
}
