import { createEndpointSchema, patchEndpointSchema } from '@webhook/shared/zod'
import { AppError } from '../../lib/errors.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function zodMessage(error: { errors: { message?: string }[] }): string {
  return error.errors[0]?.message ?? 'Validation failed'
}

export function parseEndpointId(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new AppError(404, 'not_found', 'Endpoint not found')
  }
}

export function parseCreateBody(body: unknown) {
  const parsed = createEndpointSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(400, 'validation_error', zodMessage(parsed.error))
  }
  return parsed.data
}

export function parsePatchBody(body: unknown) {
  assertNoImmutableFields(body)

  const parsed = patchEndpointSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(400, 'validation_error', zodMessage(parsed.error))
  }
  return parsed.data
}

function assertNoImmutableFields(body: unknown): void {
  if (typeof body !== 'object' || body === null) {
    return
  }

  const record = body as Record<string, unknown>
  if ('url' in record) {
    throw new AppError(400, 'immutable_field', 'url cannot be changed')
  }
  if ('secret' in record) {
    throw new AppError(400, 'immutable_field', 'secret cannot be changed')
  }
}
