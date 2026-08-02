import { ingestEventSchema } from '@webhook/shared/zod'
import { parseSchema, requireUuid } from '../../lib/validation.js'

export function parseEventId(id: string): void {
  requireUuid(id, 'Event not found')
}

export function parseIngestBody(body: unknown) {
  return parseSchema(ingestEventSchema, body)
}
