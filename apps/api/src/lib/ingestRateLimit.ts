import type { NextFunction, Request, Response } from 'express'
import { env } from '../config.js'
import { AppError } from './errors.js'
import { getRedis } from './redis.js'
import { getTenantId } from './tenant.js'

/** Fixed-window counter per tenant per UTC minute. */
export async function takeIngestRateLimitToken(tenantId: string): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 60_000)
  const key = `ingest:ratelimit:${tenantId}:${bucket}`
  const redis = getRedis()
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.pexpire(key, 60_000)
  }
  return count <= env.INGEST_RATE_LIMIT_PER_MINUTE
}

export function ingestRateLimit(req: Request, _res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const allowed = await takeIngestRateLimitToken(getTenantId(req))
      if (!allowed) {
        throw new AppError(429, 'rate_limited', 'Ingest rate limit exceeded')
      }
      next()
    } catch (err) {
      next(err)
    }
  })()
}
