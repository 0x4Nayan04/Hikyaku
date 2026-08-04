import { Router, type IRouter } from 'express'
import { requireTenantSessionAuth } from '../../auth/middleware.js'
import { createEndpoint, listEndpoints, patchEndpoint } from './handlers.js'

export const endpointsRouter: IRouter = Router()

endpointsRouter.post('/endpoints', requireTenantSessionAuth, createEndpoint)
endpointsRouter.get('/endpoints', requireTenantSessionAuth, listEndpoints)
endpointsRouter.patch('/endpoints/:id', requireTenantSessionAuth, patchEndpoint)
