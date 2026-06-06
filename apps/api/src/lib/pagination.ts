export type PaginationParams = {
  limit: number
  offset: number
}

export function parsePagination(query: {
  limit?: string | string[]
  offset?: string | string[]
}): PaginationParams {
  const limitRaw = Array.isArray(query.limit) ? query.limit[0] : query.limit
  const offsetRaw = Array.isArray(query.offset) ? query.offset[0] : query.offset

  const limit = Math.min(Math.max(parseInt(limitRaw ?? '50', 10) || 50, 1), 100)
  const offset = Math.max(parseInt(offsetRaw ?? '0', 10) || 0, 0)

  return { limit, offset }
}
