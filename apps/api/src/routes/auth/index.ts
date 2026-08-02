import { Router, type IRouter } from 'express'
import { requireSession } from '../../auth/requireSession.js'
import { authRateLimit } from '../../lib/authRateLimit.js'
import { acceptInvite, validateInvite } from './invite-handlers.js'
import { bootstrap, bootstrapStatus, changePassword, login, logout, me } from './handlers.js'

export const authRouter: IRouter = Router()

authRouter.get('/auth/bootstrap-status', bootstrapStatus)
authRouter.post('/auth/bootstrap', bootstrap)
authRouter.get('/auth/invites/validate', validateInvite)
authRouter.post('/auth/accept-invite', acceptInvite)
authRouter.post('/auth/login', authRateLimit, login)
authRouter.post('/auth/logout', requireSession, logout)
authRouter.get('/auth/me', requireSession, me)
authRouter.post('/auth/change-password', requireSession, changePassword)
