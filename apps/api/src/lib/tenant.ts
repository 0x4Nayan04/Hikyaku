import type { Request } from 'express'
import { missingTenantAuthError } from '../auth/errors.js'

export function getTenantId(req: Request): string {
  const tenantId = req.tenantId
  if (!tenantId) {
    throw missingTenantAuthError()
  }
  return tenantId
}
