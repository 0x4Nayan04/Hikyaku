import { deliveries, deliveryAttempts } from '@webhook/shared/schema'
import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { logger } from '../../lib/logger.js'
import { parsePagination } from '../../lib/pagination.js'
import { reEnqueueDelivery } from '../../queue/client.js'
import { getTenantId } from '../../lib/tenant.js'
import { toDeliveryDetailJson, toDeliveryListJson } from './serialize.js'
import { assertReplayableStatus, parseDeliveryId, parseListQuery } from './validation.js'

const deliveryColumns = {
  id: deliveries.id,
  eventId: deliveries.eventId,
  endpointId: deliveries.endpointId,
  status: deliveries.status,
  attemptCount: deliveries.attemptCount,
  nextRetryAt: deliveries.nextRetryAt,
  lastError: deliveries.lastError,
  createdAt: deliveries.createdAt,
  updatedAt: deliveries.updatedAt,
}

const attemptColumns = {
  attemptNumber: deliveryAttempts.attemptNumber,
  httpStatus: deliveryAttempts.httpStatus,
  responseBody: deliveryAttempts.responseBody,
  error: deliveryAttempts.error,
  durationMs: deliveryAttempts.durationMs,
  createdAt: deliveryAttempts.createdAt,
}

export async function listDeliveries(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, offset } = parsePagination(req.query)
    const { status } = parseListQuery(req.query)
    const tenantId = getTenantId(req)
    const db = getDb()

    const conditions = [eq(deliveries.tenantId, tenantId)]
    if (status !== undefined) {
      conditions.push(eq(deliveries.status, status))
    }
    const where = and(...conditions)

    const [countRow] = await db.select({ value: count() }).from(deliveries).where(where)
    const total = countRow?.value ?? 0

    const rows = await db
      .select(deliveryColumns)
      .from(deliveries)
      .where(where)
      .orderBy(desc(deliveries.createdAt))
      .limit(limit)
      .offset(offset)

    res.json({
      data: rows.map((row) => toDeliveryListJson(row)),
      total,
      limit,
      offset,
    })
  } catch (err) {
    next(err)
  }
}

export async function getDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseDeliveryId(id)

    const tenantId = getTenantId(req)
    const db = getDb()
    const [row] = await db
      .select(deliveryColumns)
      .from(deliveries)
      .where(and(eq(deliveries.id, id), eq(deliveries.tenantId, tenantId)))
      .limit(1)

    if (!row) {
      throw new AppError(404, 'not_found', 'Delivery not found')
    }

    const attempts = await db
      .select(attemptColumns)
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, id))
      .orderBy(asc(deliveryAttempts.attemptNumber))

    res.json(toDeliveryDetailJson(row, attempts))
  } catch (err) {
    next(err)
  }
}

async function reevaluateEventStatus(
  eventId: string,
  tx: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> },
): Promise<void> {
  await tx.execute(sql`
    WITH summary AS (
      SELECT
        count(*) FILTER (WHERE status = 'succeeded') AS s,
        count(*) FILTER (WHERE status = 'failed') AS f,
        count(*) FILTER (WHERE status IN ('pending', 'in_progress', 'deferred')) AS open
      FROM deliveries
      WHERE event_id = ${eventId}
    )
    UPDATE events SET status = CASE
      WHEN (SELECT open FROM summary) > 0 THEN 'pending'
      WHEN (SELECT s FROM summary) = 0 AND (SELECT f FROM summary) > 0 THEN 'failed'
      ELSE 'completed'
    END
    WHERE id = ${eventId}
  `)
}

export async function replayDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseDeliveryId(id)

    const tenantId = getTenantId(req)
    const db = getDb()

    const [existing] = await db
      .select({
        id: deliveries.id,
        eventId: deliveries.eventId,
        status: deliveries.status,
      })
      .from(deliveries)
      .where(and(eq(deliveries.id, id), eq(deliveries.tenantId, tenantId)))
      .limit(1)

    if (!existing) {
      throw new AppError(404, 'not_found', 'Delivery not found')
    }

    assertReplayableStatus(existing.status)

    await db.transaction(async (tx) => {
      await tx
        .update(deliveries)
        .set({
          status: 'pending',
          lastError: null,
          nextRetryAt: null,
          attemptCount: 0,
          updatedAt: new Date(),
        })
        .where(and(eq(deliveries.id, id), eq(deliveries.tenantId, tenantId)))

      await reevaluateEventStatus(existing.eventId, tx)
    })

    try {
      await reEnqueueDelivery(id)
    } catch (err) {
      logger.error({ delivery_id: id, err }, 'replay_enqueue_failed')
      throw new AppError(503, 'service_unavailable', 'Service temporarily unavailable')
    }

    res.status(202).json({ id, status: 'pending' })
  } catch (err) {
    next(err)
  }
}
