import { Router, type IRouter } from 'express'
import { requireSuperAdmin } from '../../auth/requireSuperAdmin.js'
import {
  createInvite,
  createPasswordReset,
  deleteTenant,
  deleteTenantUser,
  getTenant,
  listTenantUsers,
  listTenants,
  patchTenant,
} from './handlers.js'

export const adminRouter: IRouter = Router()

adminRouter.get('/tenants', requireSuperAdmin, listTenants)
adminRouter.get('/tenants/:id', requireSuperAdmin, getTenant)
adminRouter.get('/tenants/:id/users', requireSuperAdmin, listTenantUsers)

adminRouter.patch('/tenants/:id', requireSuperAdmin, patchTenant)
adminRouter.delete('/tenants/:id', requireSuperAdmin, deleteTenant)
adminRouter.delete('/tenants/:id/users/:userId', requireSuperAdmin, deleteTenantUser)
adminRouter.post(
  '/tenants/:id/users/:userId/reset-password',
  requireSuperAdmin,
  createPasswordReset,
)
adminRouter.post('/invites', requireSuperAdmin, createInvite)
