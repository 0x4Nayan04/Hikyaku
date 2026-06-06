import { Router, type IRouter } from 'express'
import { requireAuth } from '../../auth/middleware.js'
import { getEvent, ingestEvent, listEvents } from './handlers.js'

export const eventsRouter: IRouter = Router()

eventsRouter.post('/events', requireAuth, ingestEvent)
eventsRouter.get('/events', requireAuth, listEvents)
eventsRouter.get('/events/:id', requireAuth, getEvent)
