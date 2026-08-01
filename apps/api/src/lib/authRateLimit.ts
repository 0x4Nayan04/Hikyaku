import type { NextFunction, Request, Response } from 'express'
import { env } from '../config.js'
import { AppError } from './errors.js'
import { getRedis } from './redis.js'

function readAuthEmail(req: Request): string | undefined {
  const body = req.body
  if (typeof body !== 'object' || body === null || !('email' in body)) {
    return undefined
  }
  const email = body.email
  return typeof email === 'string' && email.length > 0 ? email.toLowerCase() : undefined
}

/** Client IP for auth throttling: direct socket in dev; trusted proxy IP in production. */
export function readAuthRateLimitIp(req: Request): string {
  if (env.NODE_ENV === 'production') {
    return req.ip || req.socket.remoteAddress || 'unknown'
  }
  return req.socket.remoteAddress || req.ip || 'unknown'
}

/** Fixed-window counter per key per UTC minute. */
export async function takeAuthRateLimitToken(key: string): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 60_000)
  const redisKey = `auth:ratelimit:${key}:${bucket}`
  const redis = getRedis()
  const count = await redis.incr(redisKey)
  if (count === 1) {
    await redis.pexpire(redisKey, 60_000)
  }
  return count <= env.AUTH_RATE_LIMIT_PER_MINUTE
}

export async function takeAuthRateLimitTokens(keys: string[]): Promise<boolean> {
  for (const key of keys) {
    if (!(await takeAuthRateLimitToken(key))) {
      return false
    }
  }
  return true
}

export function authRateLimit(req: Request, _res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const keys = [`ip:${readAuthRateLimitIp(req)}`]
      const email = readAuthEmail(req)
      if (email) {
        keys.push(`email:${email}`)
      }

      const allowed = await takeAuthRateLimitTokens(keys)
      if (!allowed) {
        throw new AppError(429, 'rate_limited', 'Too many auth attempts, try again later')
      }
      next()
    } catch (err) {
      next(err)
    }
  })()
}
