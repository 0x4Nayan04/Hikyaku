export type EndpointRow = {
  id: string
  url: string
  status: string
  description: string | null
  createdAt: Date
}

export function toEndpointJson(row: EndpointRow, secret?: string) {
  const body = {
    id: row.id,
    url: row.url,
    status: row.status,
    description: row.description,
    created_at: row.createdAt.toISOString(),
  }

  return secret === undefined ? body : { ...body, secret }
}
