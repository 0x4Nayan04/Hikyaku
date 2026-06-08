import { deliveries, deliveryAttempts } from '@webhook/shared/schema'
import { and, asc, count, desc, eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { parsePagination } from '../../lib/pagination.js'
import { getTenantId } from '../../lib/tenant.js'
import { toDeliveryDetailJson, toDeliveryListJson } from './serialize.js'
import { parseDeliveryId, parseListQuery } from './validation.js'

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
