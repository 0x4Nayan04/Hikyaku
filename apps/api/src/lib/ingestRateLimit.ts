import type { NextFunction, Request, Response } from 'express'
import { env } from '../config.js'
import { AppError } from './errors.js'
import { asyncHandler } from './asyncHandler.js'
import { readAuthRateLimitIp } from './authRateLimit.js'
import { takeFixedWindowToken } from './rateLimit.js'
import { getTenantId } from './tenant.js'

const BEARER_PREFIX = 'Bearer '

/** Cheap IP window before API-key DB lookup. Cookie ingest skips this and uses the tenant limiter. */
export const ingestIpRateLimit = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const authorization = req.get('authorization') ?? undefined
    if (!authorization?.startsWith(BEARER_PREFIX)) {
      next()
      return
    }

    const allowed = await takeFixedWindowToken(
      `ingest:ratelimit:ip:${readAuthRateLimitIp(req)}`,
      env.INGEST_RATE_LIMIT_PER_MINUTE,
    )
    if (!allowed) {
      throw new AppError(429, 'rate_limited', 'Ingest rate limit exceeded')
    }
    next()
  },
)

export const ingestRateLimit = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const allowed = await takeFixedWindowToken(
      `ingest:ratelimit:${getTenantId(req)}`,
      env.INGEST_RATE_LIMIT_PER_MINUTE,
    )
    if (!allowed) {
      throw new AppError(429, 'rate_limited', 'Ingest rate limit exceeded')
    }
    next()
  },
)
