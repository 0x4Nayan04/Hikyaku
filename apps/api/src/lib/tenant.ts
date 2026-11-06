import type { Request } from 'express'
import { unauthorizedTenantAuth } from '../auth/unauthorized.js'

export function getTenantId(req: Request): string {
  const tenantId = req.tenantId
  if (!tenantId) {
    throw unauthorizedTenantAuth()
  }
  return tenantId
}
