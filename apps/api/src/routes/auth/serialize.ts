export type UserRow = {
  id: string
  email: string
  name: string
  isSuperAdmin: boolean
}

export type TenantRow = {
  id: string
  name: string
}

export function toUserJson(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    is_super_admin: row.isSuperAdmin,
  }
}

export function toTenantJson(row: TenantRow) {
  return {
    id: row.id,
    name: row.name,
  }
}

export function toBootstrapUserJson(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    is_super_admin: row.isSuperAdmin,
  }
}
