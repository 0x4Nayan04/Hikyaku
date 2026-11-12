import { Router, type IRouter } from 'express'
import { requireTenantSessionAuth } from '../../auth/middleware.js'
import {
  createEndpoint,
  listEndpoints,
  removeEndpoint,
  patchEndpoint,
  rotateEndpointSecret,
} from './handlers.js'

export const endpointsRouter: IRouter = Router()

endpointsRouter.post('/endpoints', requireTenantSessionAuth, createEndpoint)
endpointsRouter.get('/endpoints', requireTenantSessionAuth, listEndpoints)
endpointsRouter.patch('/endpoints/:id', requireTenantSessionAuth, patchEndpoint)
endpointsRouter.post('/endpoints/:id/rotate', requireTenantSessionAuth, rotateEndpointSecret)

endpointsRouter.delete('/endpoints/:id', requireTenantSessionAuth, removeEndpoint)
