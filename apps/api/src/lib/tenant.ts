import type { Request } from 'express'
import { AppError } from './errors.js'

export function getTenantId(req: Request): string {
  const tenantId = req.tenantId
  if (!tenantId) {
    throw new AppError(401, 'unauthorized', 'Missing or invalid Bearer token')
  }
  return tenantId
}
