import { Router, type IRouter } from 'express'
import { requireTenantSessionAuth } from '../../auth/middleware.js'
import { getDelivery, listDeliveries, replayDelivery } from './handlers.js'

export const deliveriesRouter: IRouter = Router()

deliveriesRouter.get('/deliveries', requireTenantSessionAuth, listDeliveries)
deliveriesRouter.get('/deliveries/:id', requireTenantSessionAuth, getDelivery)
deliveriesRouter.post('/deliveries/:id/replay', requireTenantSessionAuth, replayDelivery)
