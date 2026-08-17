import { AppError } from './errors.js'

export type PaginationParams = {
  limit: number
  offset: number
}

export function takePage<T>(rows: T[], limit: number): { data: T[]; hasMore: boolean } {
  const hasMore = rows.length > limit
  return { data: hasMore ? rows.slice(0, limit) : rows, hasMore }
}

export function paginatedJson<T>(data: T[], hasMore: boolean, limit: number, offset: number) {
  return { data, has_more: hasMore, limit, offset }
}

function parseInteger(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined) return fallback
  if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new AppError(400, 'validation_error', `${name} must be an integer`)
  }
  return Number(value)
}

export function parsePagination(query: {
  limit?: string | string[]
  offset?: string | string[]
}): PaginationParams {
  const limitRaw = Array.isArray(query.limit) ? query.limit[0] : query.limit
  const offsetRaw = Array.isArray(query.offset) ? query.offset[0] : query.offset

  const limitParsed = parseInteger(limitRaw, 'limit', 50)
  const offsetParsed = parseInteger(offsetRaw, 'offset', 0)

  const limit = Math.min(Math.max(limitParsed, 1), 100)
  const offset = Math.max(offsetParsed, 0)

  return { limit, offset }
}
