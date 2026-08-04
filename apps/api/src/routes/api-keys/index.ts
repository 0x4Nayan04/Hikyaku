import { Router, type IRouter } from 'express'
import { requireTenantSessionAuth } from '../../auth/middleware.js'
import { createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from './handlers.js'

export const apiKeysRouter: IRouter = Router()

apiKeysRouter.get('/api-keys', requireTenantSessionAuth, listApiKeys)
apiKeysRouter.post('/api-keys', requireTenantSessionAuth, createApiKey)
apiKeysRouter.post('/api-keys/:id/revoke', requireTenantSessionAuth, revokeApiKey)
apiKeysRouter.post('/api-keys/:id/rotate', requireTenantSessionAuth, rotateApiKey)
