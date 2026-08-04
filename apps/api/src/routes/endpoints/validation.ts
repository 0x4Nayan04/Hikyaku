import { ENDPOINT_STATUSES, type EndpointStatus } from '@webhook/shared/constants'
import { createEndpointSchema, patchEndpointSchema } from '@webhook/shared/zod'
import { AppError } from '../../lib/errors.js'
import { parseSchema, requireUuid } from '../../lib/validation.js'

const ENDPOINT_STATUS_SET = new Set<string>(ENDPOINT_STATUSES)

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

export function parseListQuery(query: {
  status?: string | string[]
}): { status?: EndpointStatus } {
  const statusRaw = Array.isArray(query.status) ? query.status[0] : query.status

  if (statusRaw === undefined) return {}
  if (!ENDPOINT_STATUS_SET.has(statusRaw)) {
    throw new AppError(400, 'validation_error', 'Invalid status filter')
  }

  return { status: statusRaw as EndpointStatus }
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
