import { bootstrapSchema, changePasswordSchema, loginSchema } from '@webhook/shared/zod'
import type { Request } from 'express'
import { env } from '../../config.js'
import { AppError } from '../../lib/errors.js'
import { parseSchema } from '../../lib/validation.js'

export function requireAdminSecret(req: Request): void {
  const secret = req.get('x-admin-secret')
  if (secret !== env.ADMIN_BOOTSTRAP_SECRET) {
    throw new AppError(401, 'invalid_admin_secret', 'Wrong or missing X-Admin-Secret')
  }
}

export function parseBootstrapBody(body: unknown) {
  return parseSchema(bootstrapSchema, body)
}

export function parseLoginBody(body: unknown) {
  return parseSchema(loginSchema, body)
}

export function parseChangePasswordBody(body: unknown) {
  return parseSchema(changePasswordSchema, body)
}
