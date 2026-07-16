import { Router, type IRouter, type NextFunction, type Request, type Response } from 'express'
import { requireSuperAdmin } from '../../auth/requireSuperAdmin.js'
import { createInvite } from '../invites/handlers.js'
import { listAuditLog } from './audit-handlers.js'
import { createTenantUser, createTenantWithOwner, deleteTenant, getTenant, listTenantUsers, listTenants, patchTenant } from './handlers.js'
import { createTenantLegacy } from './legacy.js'
import {
  approveSignupRequest,
  listSignupRequests,
  rejectSignupRequest,
} from './signup-request-handlers.js'

export const adminRouter: IRouter = Router()

adminRouter.get('/tenants', requireSuperAdmin, listTenants)
adminRouter.get('/tenants/:id', requireSuperAdmin, getTenant)
adminRouter.get('/tenants/:id/users', requireSuperAdmin, listTenantUsers)

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

adminRouter.patch('/tenants/:id', requireSuperAdmin, patchTenant)
adminRouter.delete('/tenants/:id', requireSuperAdmin, deleteTenant)
adminRouter.post('/tenants/:id/users', requireSuperAdmin, createTenantUser)
adminRouter.post('/invites', requireSuperAdmin, createInvite)
adminRouter.get('/signup-requests', requireSuperAdmin, listSignupRequests)
adminRouter.post('/signup-requests/:id/approve', requireSuperAdmin, approveSignupRequest)
adminRouter.post('/signup-requests/:id/reject', requireSuperAdmin, rejectSignupRequest)
adminRouter.get('/audit-log', requireSuperAdmin, listAuditLog)
