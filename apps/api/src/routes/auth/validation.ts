import { createHash, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'
import { env } from '../../config.js'
import { AppError } from '../../lib/errors.js'

function secretsMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash('sha256').update(provided).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(providedDigest, expectedDigest)
}

export function requireAdminSecret(req: Request): void {
  const secret = req.get('x-admin-secret') ?? ''
  if (!secretsMatch(secret, env.ADMIN_BOOTSTRAP_SECRET)) {
    throw new AppError(401, 'invalid_admin_secret', 'Wrong or missing X-Admin-Secret')
  }
}
