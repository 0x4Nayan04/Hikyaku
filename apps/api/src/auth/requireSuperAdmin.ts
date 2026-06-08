import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../lib/errors.js'
import { attachSessionUser } from './requireSession.js'

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  void (async () => {
    try {
      await attachSessionUser(req)
      if (!req.isSuperAdmin) {
        throw new AppError(403, 'forbidden', 'Super-admin access required')
      }
      next()
    } catch (err) {
      next(err)
    }
  })()
}
