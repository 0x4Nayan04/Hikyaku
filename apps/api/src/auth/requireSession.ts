import { eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { tenants, users } from '@webhook/shared/schema'
import { getDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import {
  createCredentialFingerprint,
  readSessionUserBlob,
  writeSessionUser,
  type SessionUserBlob,
} from './session.js'

function applySessionUser(req: Request, user: SessionUserBlob): void {
  req.userId = user.userId
  req.tenantId = user.tenantId ?? undefined
  req.isSuperAdmin = user.isSuperAdmin
}

export async function attachSessionUser(req: Request): Promise<void> {
  const blob = readSessionUserBlob(req.session)
  if (!blob) {
    throw new AppError(401, 'unauthorized', 'Missing or invalid session')
  }

  const rows = await getDb()
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      tenantId: users.tenantId,
      isSuperAdmin: users.isSuperAdmin,
      passwordHash: users.passwordHash,
      tenantName: tenants.name,
    })
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(eq(users.id, blob.userId))
    .limit(1)

  const user = rows[0]
  if (!user) {
    throw new AppError(401, 'unauthorized', 'Missing or invalid session')
  }

  if (createCredentialFingerprint(user.passwordHash) !== blob.credentialFingerprint) {
    throw new AppError(401, 'unauthorized', 'Missing or invalid session')
  }

  const hydrated: SessionUserBlob = {
    userId: user.id,
    email: user.email,
    name: user.name,
    tenantId: user.tenantId,
    isSuperAdmin: user.isSuperAdmin,
    tenantName: user.tenantName,
    credentialFingerprint: blob.credentialFingerprint,
  }
  writeSessionUser(req.session, hydrated)
  applySessionUser(req, hydrated)
}

export const requireSession = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    await attachSessionUser(req)
    next()
  },
)
