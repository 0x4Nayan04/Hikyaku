import { Router, type IRouter } from 'express'
import { requireSession } from '../../auth/requireSession.js'
import { acceptInvite, validateInvite } from './invite-handlers.js'
import { createSignupRequest } from './signup-handlers.js'
import { bootstrap, changePassword, login, logout, me } from './handlers.js'

export const authRouter: IRouter = Router()

authRouter.post('/auth/bootstrap', bootstrap)
authRouter.post('/auth/signup', createSignupRequest)
authRouter.get('/auth/invites/validate', validateInvite)
authRouter.post('/auth/accept-invite', acceptInvite)
authRouter.post('/auth/login', login)
authRouter.post('/auth/logout', requireSession, logout)
authRouter.get('/auth/me', requireSession, me)
authRouter.post('/auth/change-password', requireSession, changePassword)
