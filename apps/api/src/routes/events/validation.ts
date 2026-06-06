import { ingestEventSchema } from '@webhook/shared/zod'
import { AppError } from '../../lib/errors.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function zodMessage(error: { errors: { message?: string }[] }): string {
  return error.errors[0]?.message ?? 'Validation failed'
}

export function parseEventId(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new AppError(404, 'not_found', 'Event not found')
  }
}

export function parseIngestBody(body: unknown) {
  const parsed = ingestEventSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(400, 'validation_error', zodMessage(parsed.error))
  }
  return parsed.data
}
