import { Router, type IRouter } from 'express'
import { requireTenantAuth, requireTenantSessionAuth } from '../../auth/middleware.js'
import { ingestIpRateLimit, ingestRateLimit } from '../../lib/ingestRateLimit.js'
import { EVENTS_PATH } from './ingest-route.js'
import { getEvent, ingestEvent, listEvents } from './handlers.js'

export const eventsRouter: IRouter = Router()

eventsRouter.post(EVENTS_PATH, ingestIpRateLimit, requireTenantAuth, ingestRateLimit, ingestEvent)
eventsRouter.get(EVENTS_PATH, requireTenantSessionAuth, listEvents)
eventsRouter.get(`${EVENTS_PATH}/:id`, requireTenantSessionAuth, getEvent)
