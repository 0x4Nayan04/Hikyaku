import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/errors.js'
import { resolveTenantId } from './apiKey.js'
import { attachSessionUser } from './requireSession.js'

const BEARER_PREFIX = 'Bearer '
const UNAUTHORIZED_MESSAGE = 'Missing or invalid Bearer token or session'

function parseBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith(BEARER_PREFIX)) {
    return null
  }

  const token = header.slice(BEARER_PREFIX.length).trim()
  return token.length > 0 ? token : null
}

const SESSION_UNAUTHORIZED_MESSAGE = 'Missing or invalid session'

export function requireTenantSession(req: Request, _res: Response, next: NextFunction): void {
  void (async () => {
    try {
      await attachSessionUser(req)

      if (!req.tenantId || req.isSuperAdmin) {
        throw new AppError(401, 'unauthorized', SESSION_UNAUTHORIZED_MESSAGE)
      }

      next()
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 401) {
        next(new AppError(401, 'unauthorized', SESSION_UNAUTHORIZED_MESSAGE))
        return
      }
      next(err)
    }
  })()
}

export function requireTenantAuth(req: Request, _res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const token = parseBearerToken(req.get('authorization') ?? undefined)
      if (token !== null) {
        const tenantId = await resolveTenantId(token)
        if (!tenantId) {
          throw new AppError(401, 'unauthorized', UNAUTHORIZED_MESSAGE)
        }

        req.tenantId = tenantId
        next()
        return
      }

      try {
        await attachSessionUser(req)
      } catch (err) {
        if (err instanceof AppError && err.statusCode === 401) {
          throw new AppError(401, 'unauthorized', UNAUTHORIZED_MESSAGE)
        }
        throw err
      }

      if (!req.tenantId || req.isSuperAdmin) {
        throw new AppError(401, 'unauthorized', UNAUTHORIZED_MESSAGE)
      }

      next()
    } catch (err) {
      next(err)
    }
  })()
}
