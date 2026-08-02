import type { NextFunction, Request, Response } from 'express'
import { env } from '../config.js'
import { AppError } from './errors.js'
import { asyncHandler } from './asyncHandler.js'
import { takeFixedWindowToken } from './rateLimit.js'
import { getTenantId } from './tenant.js'

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
