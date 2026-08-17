import { deliveries, events } from '@webhook/shared/schema'
import { and, count, eq, gte, inArray, sql } from 'drizzle-orm'
import { Router, type IRouter } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { requireTenantSessionAuth } from '../auth/middleware.js'
import { getDb } from '../db/client.js'
import { getTenantId } from '../lib/tenant.js'

export const statsRouter: IRouter = Router()

function utcMidnightToday(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export async function loadTenantStats(tenantId: string) {
  const db = getDb()
  const sinceMidnightUtc = utcMidnightToday()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [[eventsTodayRow], [activeRow], [terminal24hRow]] = await Promise.all([
    db
      .select({ value: count() })
      .from(events)
      .where(and(eq(events.tenantId, tenantId), gte(events.createdAt, sinceMidnightUtc))),
    db
      .select({ value: count() })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.tenantId, tenantId),
          inArray(deliveries.status, ['pending', 'in_progress']),
        ),
      ),
    db
      .select({
        succeeded: sql<number>`cast(count(*) filter (where ${deliveries.status} = 'succeeded') as int)`,
        failed: sql<number>`cast(count(*) filter (where ${deliveries.status} = 'failed') as int)`,
      })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.tenantId, tenantId),
          inArray(deliveries.status, ['succeeded', 'failed']),
          gte(deliveries.updatedAt, since24h),
        ),
      ),
  ])

  const deliveriesSucceeded24h = terminal24hRow?.succeeded ?? 0
  const deliveriesFailed24h = terminal24hRow?.failed ?? 0
  const terminal24h = deliveriesSucceeded24h + deliveriesFailed24h

  return {
    events_today: eventsTodayRow?.value ?? 0,
    deliveries_active: activeRow?.value ?? 0,
    deliveries_succeeded_24h: deliveriesSucceeded24h,
    deliveries_failed_24h: deliveriesFailed24h,
    success_rate_24h: terminal24h === 0 ? null : deliveriesSucceeded24h / terminal24h,
  }
}

async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await loadTenantStats(getTenantId(req))
    res.json(stats)
  } catch (err) {
    next(err)
  }
}

statsRouter.get('/stats', requireTenantSessionAuth, getStats)
