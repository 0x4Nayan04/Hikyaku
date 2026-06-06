import { Router, type IRouter } from 'express'
import { requireAuth } from '../../auth/middleware.js'
import { createEndpoint, listEndpoints, patchEndpoint } from './handlers.js'

export const endpointsRouter: IRouter = Router()

endpointsRouter.post('/endpoints', requireAuth, createEndpoint)
endpointsRouter.get('/endpoints', requireAuth, listEndpoints)
endpointsRouter.patch('/endpoints/:id', requireAuth, patchEndpoint)
