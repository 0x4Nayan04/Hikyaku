export type AdminTenantRow = {
  id: string
  name: string
  createdAt: Date
}

export function toAdminTenantJson(row: AdminTenantRow) {
  return {
    id: row.id,
    name: row.name,
    created_at: row.createdAt.toISOString(),
  }
}
