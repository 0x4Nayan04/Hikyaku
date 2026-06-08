export type ApiKeyRow = {
  id: string
  prefix: string
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

export function toApiKeyJson(row: ApiKeyRow, apiKey?: string) {
  const body = {
    id: row.id,
    prefix: row.prefix,
    created_at: row.createdAt.toISOString(),
    last_used_at: row.lastUsedAt?.toISOString() ?? null,
    revoked_at: row.revokedAt?.toISOString() ?? null,
  }

  return apiKey === undefined ? body : { ...body, api_key: apiKey }
}
