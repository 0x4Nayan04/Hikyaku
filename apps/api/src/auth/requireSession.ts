import { eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { users } from '@webhook/shared/schema'
import { getDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export async function attachSessionUser(req: Request): Promise<void> {
  const userId = req.session?.userId
  if (!userId) {
    throw new AppError(401, 'unauthorized', 'Missing or invalid session')
  }

  const rows = await getDb()
    .select({
      id: users.id,
      tenantId: users.tenantId,
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const user = rows[0]
  if (!user) {
    throw new AppError(401, 'unauthorized', 'Missing or invalid session')
  }

  req.userId = user.id
  req.tenantId = user.tenantId ?? undefined
  req.isSuperAdmin = user.isSuperAdmin
}

export const requireSession = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    await attachSessionUser(req)
    next()
  },
)
