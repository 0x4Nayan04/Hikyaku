import type { NextFunction, Request, Response } from 'express'
import { env } from '../config.js'
import { AppError } from './errors.js'
import { asyncHandler } from './asyncHandler.js'
import { takeFixedWindowToken } from './rateLimit.js'

function readAuthEmail(req: Request): string | undefined {
  const body = req.body
  if (typeof body !== 'object' || body === null || !('email' in body)) {
    return undefined
  }
  const email = body.email
  return typeof email === 'string' && email.trim().length > 0
    ? email.trim().toLowerCase()
    : undefined
}

/** Client IP for auth throttling. Honors X-Forwarded-For only when TRUST_PROXY > 0. */
export function readAuthRateLimitIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown'
}

export const authRateLimit = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const keys = [`auth:ratelimit:ip:${readAuthRateLimitIp(req)}`]
    const email = readAuthEmail(req)
    if (email) {
      keys.push(`auth:ratelimit:email:${email}`)
    }

    for (const key of keys) {
      const allowed = await takeFixedWindowToken(key, env.AUTH_RATE_LIMIT_PER_MINUTE)
      if (!allowed) {
        throw new AppError(429, 'rate_limited', 'Too many auth attempts, try again later')
      }
    }
    next()
  },
)
