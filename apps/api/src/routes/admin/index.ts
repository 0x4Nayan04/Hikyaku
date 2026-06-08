import { Router, type IRouter, type NextFunction, type Request, type Response } from 'express'
import { requireSuperAdmin } from '../../auth/requireSuperAdmin.js'
import { createTenantUser, createTenantWithOwner, listTenants } from './handlers.js'
import { createTenantLegacy } from './legacy.js'

export const adminRouter: IRouter = Router()

adminRouter.get('/tenants', requireSuperAdmin, listTenants)

adminRouter.post('/tenants', (req: Request, res: Response, next: NextFunction) => {
  if (req.get('x-admin-secret')) {
    void createTenantLegacy(req, res, next)
    return
  }

  requireSuperAdmin(req, res, (err) => {
    if (err) {
      next(err)
      return
    }
    void createTenantWithOwner(req, res, next)
  })
})

adminRouter.post('/tenants/:id/users', requireSuperAdmin, createTenantUser)
