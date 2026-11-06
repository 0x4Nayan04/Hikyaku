import type { Request } from 'express'
import { unauthorizedSession } from './unauthorized.js'

export function requireSessionUserId(req: Request): string {
  if (!req.userId) {
    throw unauthorizedSession()
  }
  return req.userId
}
