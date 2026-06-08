import { Router, type IRouter } from 'express'
import { requireAuth } from '../../auth/middleware.js'
import { getDelivery, listDeliveries } from './handlers.js'

export const deliveriesRouter: IRouter = Router()

deliveriesRouter.get('/deliveries', requireAuth, listDeliveries)
deliveriesRouter.get('/deliveries/:id', requireAuth, getDelivery)
