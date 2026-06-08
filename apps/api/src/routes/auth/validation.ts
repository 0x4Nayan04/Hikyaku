import {
  bootstrapSchema,
  changePasswordSchema,
  loginSchema,
} from '@webhook/shared/zod'
import type { Request } from 'express'
import { env } from '../../config.js'
import { AppError } from '../../lib/errors.js'

function zodMessage(error: { errors: { message?: string }[] }): string {
  return error.errors[0]?.message ?? 'Validation failed'
}

export function requireAdminSecret(req: Request): void {
  const secret = req.get('x-admin-secret')
  if (secret !== env.ADMIN_BOOTSTRAP_SECRET) {
    throw new AppError(401, 'invalid_admin_secret', 'Wrong or missing X-Admin-Secret')
  }
}

export function parseBootstrapBody(body: unknown) {
  const parsed = bootstrapSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(400, 'validation_error', zodMessage(parsed.error))
  }
  return parsed.data
}

export function parseLoginBody(body: unknown) {
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(400, 'validation_error', zodMessage(parsed.error))
  }
  return parsed.data
}

export function parseChangePasswordBody(body: unknown) {
  const parsed = changePasswordSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(400, 'validation_error', zodMessage(parsed.error))
  }
  return parsed.data
}
