import { Router, type IRouter } from 'express'
import { requireTenantAuth, requireTenantSessionAuth } from '../../auth/middleware.js'
import { ingestRateLimit } from '../../lib/ingestRateLimit.js'
import { getEvent, ingestEvent, listEvents } from './handlers.js'

export const eventsRouter: IRouter = Router()

eventsRouter.post('/events', requireTenantAuth, ingestRateLimit, ingestEvent)
eventsRouter.get('/events', requireTenantSessionAuth, listEvents)
eventsRouter.get('/events/:id', requireTenantSessionAuth, getEvent)
