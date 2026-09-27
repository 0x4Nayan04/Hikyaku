import { EVENT_STATUSES, type EventStatus } from '@webhook/shared/constants'
import { ingestEventSchema } from '@webhook/shared/zod'
import { AppError } from '../../lib/errors.js'
import { parseSchema, requireUuid } from '../../lib/validation.js'

const EVENT_STATUS_SET = new Set<string>(EVENT_STATUSES)

export function parseEventId(id: string): void {
  requireUuid(id, 'Event not found')
}

export function parseIngestBody(body: unknown) {
  return parseSchema(ingestEventSchema, body)
}

export function parseListQuery(query: { status?: string | string[] }): { status?: EventStatus } {
  const statusRaw = Array.isArray(query.status) ? query.status[0] : query.status

  if (statusRaw === undefined) return {}
  if (!EVENT_STATUS_SET.has(statusRaw)) {
    throw new AppError(400, 'validation_error', 'Invalid status filter')
  }

  return { status: statusRaw as EventStatus }
}
