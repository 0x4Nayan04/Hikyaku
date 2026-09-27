import { timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import type { NextFunction, Request, Response } from 'express'
import { env } from '../config.js'
import { AppError } from './errors.js'
import { asyncHandler } from './asyncHandler.js'
import { PROXY_CLIENT_IP_HEADER, PROXY_SECRET_HEADER } from './proxyUpstream.js'
import { takeFixedWindowTokens } from './rateLimit.js'

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

function proxyClientIp(req: Request): string | undefined {
  const secret = env.PROXY_IP_SECRET
  if (!secret) return undefined

  const provided = req.header(PROXY_SECRET_HEADER)
  const ip = req.header(PROXY_CLIENT_IP_HEADER)
  if (!provided || !ip || isIP(ip) === 0) return undefined

  const providedBytes = Buffer.from(provided)
  const secretBytes = Buffer.from(secret)
  if (providedBytes.length !== secretBytes.length || !timingSafeEqual(providedBytes, secretBytes)) {
    return undefined
  }
  return ip
}

/** Client IP for auth throttling. The Vercel proxy may supply the browser IP with a shared secret. */
export function readAuthRateLimitIp(req: Request): string {
  return proxyClientIp(req) || req.ip || req.socket.remoteAddress || 'unknown'
}

export const authRateLimit = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const keys = [`auth:ratelimit:ip:${readAuthRateLimitIp(req)}`]
    const email = readAuthEmail(req)
    if (email) {
      keys.push(`auth:ratelimit:email:${email}`)
    }

    const allowed = await takeFixedWindowTokens(keys, env.AUTH_RATE_LIMIT_PER_MINUTE)
    if (!allowed) {
      throw new AppError(429, 'rate_limited', 'Too many auth attempts, try again later')
    }
    next()
  },
)
