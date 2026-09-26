import type { Request } from 'express'
import { env } from '../../config.js'
import { AppError } from '../../lib/errors.js'

export function requireAdminSecret(req: Request): void {
  const secret = req.get('x-admin-secret')
  if (secret !== env.ADMIN_BOOTSTRAP_SECRET) {
    throw new AppError(401, 'invalid_admin_secret', 'Wrong or missing X-Admin-Secret')
  }
}
