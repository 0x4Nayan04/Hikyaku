import { createEndpointSchema, patchEndpointSchema } from '@webhook/shared/zod'
import { AppError } from '../../lib/errors.js'
import { parseSchema, requireUuid } from '../../lib/validation.js'

export function parseEndpointId(id: string): void {
  requireUuid(id, 'Endpoint not found')
}

export function parseCreateBody(body: unknown) {
  return parseSchema(createEndpointSchema, body)
}

export function parsePatchBody(body: unknown) {
  assertNoImmutableFields(body)

  return parseSchema(patchEndpointSchema, body)
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
