import {
  adminCreateTenantSchema,
  adminCreateUserSchema,
  adminPatchTenantSchema,
  adminResetUserPasswordSchema,
} from '@webhook/shared/zod'
import { AppError } from '../../lib/errors.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function zodMessage(error: { errors: { message?: string }[] }): string {
  return error.errors[0]?.message ?? 'Validation failed'
}

export function parseTenantId(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new AppError(404, 'not_found', 'Tenant not found')
  }
}

export function parseUserId(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new AppError(404, 'not_found', 'User not found')
  }
}

export function parseCreateTenantBody(body: unknown) {
  const parsed = adminCreateTenantSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(400, 'validation_error', zodMessage(parsed.error))
  }
  return parsed.data
}

export function parseCreateUserBody(body: unknown) {
  const parsed = adminCreateUserSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(400, 'validation_error', zodMessage(parsed.error))
  }
  return parsed.data
}

export function parsePatchTenantBody(body: unknown) {
  const parsed = adminPatchTenantSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(400, 'validation_error', zodMessage(parsed.error))
  }
  return parsed.data
}

export function parseResetUserPasswordBody(body: unknown) {
  const parsed = adminResetUserPasswordSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(400, 'validation_error', zodMessage(parsed.error))
  }
  return parsed.data
}
