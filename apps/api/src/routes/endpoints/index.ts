import { Router, type IRouter } from 'express'
import { requireTenantAuth } from '../../auth/middleware.js'
import { createEndpoint, listEndpoints, patchEndpoint } from './handlers.js'

export const endpointsRouter: IRouter = Router()

endpointsRouter.post('/endpoints', requireTenantAuth, createEndpoint)
endpointsRouter.get('/endpoints', requireTenantAuth, listEndpoints)
endpointsRouter.patch('/endpoints/:id', requireTenantAuth, patchEndpoint)
