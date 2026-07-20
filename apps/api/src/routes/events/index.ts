import { Router, type IRouter } from 'express'
import { requireTenantAuth } from '../../auth/middleware.js'
import { ingestRateLimit } from '../../lib/ingestRateLimit.js'
import { getEvent, ingestEvent, listEvents } from './handlers.js'

export const eventsRouter: IRouter = Router()

eventsRouter.post('/events', requireTenantAuth, ingestRateLimit, ingestEvent)
eventsRouter.get('/events', requireTenantAuth, listEvents)
eventsRouter.get('/events/:id', requireTenantAuth, getEvent)
