import { Router, type IRouter } from 'express'
import { requireTenantAuth } from '../../auth/middleware.js'
import { createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from './handlers.js'

export const apiKeysRouter: IRouter = Router()

apiKeysRouter.get('/api-keys', requireTenantAuth, listApiKeys)
apiKeysRouter.post('/api-keys', requireTenantAuth, createApiKey)
apiKeysRouter.post('/api-keys/:id/revoke', requireTenantAuth, revokeApiKey)
apiKeysRouter.post('/api-keys/:id/rotate', requireTenantAuth, rotateApiKey)
