import { Router, type IRouter } from 'express'
import { requireTenantAuth, requireTenantSession } from '../../auth/middleware.js'
import { getDelivery, listDeliveries, replayDelivery } from './handlers.js'
import { streamDeliveries } from './stream.js'

export const deliveriesRouter: IRouter = Router()

deliveriesRouter.get('/deliveries/stream', requireTenantSession, streamDeliveries)
deliveriesRouter.get('/deliveries', requireTenantAuth, listDeliveries)
deliveriesRouter.get('/deliveries/:id', requireTenantAuth, getDelivery)
deliveriesRouter.post('/deliveries/:id/replay', requireTenantAuth, replayDelivery)
