import { deliveries, events } from '@webhook/shared/schema'
import { and, count, eq, gte, inArray } from 'drizzle-orm'
import { Router, type IRouter } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { requireTenantAuth } from '../auth/middleware.js'
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

  const [
    [eventsTodayRow],
    [pendingRow],
    [deferredRow],
    [succeeded24hRow],
    [failed24hRow],
  ] = await Promise.all([
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
          inArray(deliveries.status, ['pending', 'in_progress', 'deferred']),
        ),
      ),
    db
      .select({ value: count() })
      .from(deliveries)
      .where(and(eq(deliveries.tenantId, tenantId), eq(deliveries.status, 'deferred'))),
    db
      .select({ value: count() })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.tenantId, tenantId),
          eq(deliveries.status, 'succeeded'),
          gte(deliveries.updatedAt, since24h),
        ),
      ),
    db
      .select({ value: count() })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.tenantId, tenantId),
          eq(deliveries.status, 'failed'),
          gte(deliveries.updatedAt, since24h),
        ),
      ),
  ])

  const deliveriesSucceeded24h = succeeded24hRow?.value ?? 0
  const deliveriesFailed24h = failed24hRow?.value ?? 0
  const terminal24h = deliveriesSucceeded24h + deliveriesFailed24h

  return {
    events_today: eventsTodayRow?.value ?? 0,
    deliveries_active: pendingRow?.value ?? 0,
    deliveries_deferred: deferredRow?.value ?? 0,
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

statsRouter.get('/stats', requireTenantAuth, getStats)

statsRouter.get('/tenants/:tenantId', requireTenantAuth, (req, res) => {
  if (req.params.tenantId !== req.tenantId) {
    res.status(404).json({
      error: { code: 'not_found', message: 'Not found' },
    })
    return
  }

  res.json({ id: req.tenantId })
})
