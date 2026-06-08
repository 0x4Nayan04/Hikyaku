import { Router, type IRouter } from 'express'
import { requireSession } from '../../auth/requireSession.js'
import {
  bootstrap,
  changePassword,
  login,
  logout,
  me,
} from './handlers.js'

export const authRouter: IRouter = Router()

authRouter.post('/auth/bootstrap', bootstrap)
authRouter.post('/auth/login', login)
authRouter.post('/auth/logout', requireSession, logout)
authRouter.get('/auth/me', requireSession, me)
authRouter.post('/auth/change-password', requireSession, changePassword)
