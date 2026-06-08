import { Router, type IRouter } from 'express'
import { requireTenantAuth } from '../../auth/middleware.js'
import { getEvent, ingestEvent, listEvents } from './handlers.js'

export const eventsRouter: IRouter = Router()

eventsRouter.post('/events', requireTenantAuth, ingestEvent)
eventsRouter.get('/events', requireTenantAuth, listEvents)
eventsRouter.get('/events/:id', requireTenantAuth, getEvent)
