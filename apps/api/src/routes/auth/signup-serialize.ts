export type SignupRequestPublicRow = {
  id: string
  tenantName: string
  email: string
  name: string
  status: string
  createdAt: Date
}

export function toSignupRequestJson(row: SignupRequestPublicRow) {
  return {
    id: row.id,
    tenant_name: row.tenantName,
    email: row.email,
    name: row.name,
    status: row.status,
    created_at: row.createdAt.toISOString(),
  }
}
