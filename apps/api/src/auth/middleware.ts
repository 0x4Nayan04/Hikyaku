import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/errors.js'
import { asyncHandler } from '../lib/asyncHandler.js'
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

async function requireTenantSession(req: Request): Promise<void> {
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
}

export const requireTenantSessionAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    await requireTenantSession(req)
    next()
  },
)

export const requireTenantAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
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

    await requireTenantSession(req)
    next()
  },
)
