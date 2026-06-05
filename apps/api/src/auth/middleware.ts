import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/errors.js'
import { resolveTenantId } from './apiKey.js'

const BEARER_PREFIX = 'Bearer '

function parseBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith(BEARER_PREFIX)) {
    return null
  }

  const token = header.slice(BEARER_PREFIX.length).trim()
  return token.length > 0 ? token : null
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const token = parseBearerToken(req.get('authorization') ?? undefined)
      if (!token) {
        throw new AppError(401, 'unauthorized', 'Missing or invalid Bearer token')
      }

      const tenantId = await resolveTenantId(token)
      if (!tenantId) {
        throw new AppError(401, 'unauthorized', 'Missing or invalid Bearer token')
      }

      req.tenantId = tenantId
      next()
    } catch (err) {
      next(err)
    }
  })()
}
