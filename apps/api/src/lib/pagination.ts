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

  const limitParsed = parseInt(limitRaw ?? '50', 10)
  const offsetParsed = parseInt(offsetRaw ?? '0', 10)

  const limit = Math.min(Math.max(Number.isNaN(limitParsed) ? 50 : limitParsed, 1), 100)
  const offset = Math.max(Number.isNaN(offsetParsed) ? 0 : offsetParsed, 0)

  return { limit, offset }
}
