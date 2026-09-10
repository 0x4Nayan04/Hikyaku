import { users } from '@webhook/shared/schema'

export const userColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  isSuperAdmin: users.isSuperAdmin,
  tenantId: users.tenantId,
}

export type UserRow = {
  id: string
  email: string
  name: string
  tenantId?: string | null
  isSuperAdmin: boolean
}

export function toUserJson(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    is_super_admin: row.isSuperAdmin,
    tenant_id: row.tenantId ?? null,
  }
}
