import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/errors.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { attachSessionUser } from './requireSession.js'

export const requireSuperAdmin = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    await attachSessionUser(req)
    if (!req.isSuperAdmin) {
      throw new AppError(403, 'forbidden', 'Super-admin access required')
    }
    next()
  },
)
