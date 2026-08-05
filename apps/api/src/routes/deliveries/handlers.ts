import { deliveries, deliveryAttempts, endpoints } from '@webhook/shared/schema'
import { reevaluateEventStatus } from '@webhook/shared/eventStatus'
import { enqueueDeliveryJob } from '@webhook/shared/enqueueDelivery'
import { and, asc, count, desc, eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { logger } from '../../lib/logger.js'
import { parsePagination } from '../../lib/pagination.js'
import { queue } from '../../queue/client.js'
import { getTenantId } from '../../lib/tenant.js'
import { toDeliveryDetailJson, toDeliveryListJson } from './serialize.js'
import { assertReplayableStatus, parseDeliveryId, parseListQuery } from './validation.js'

const deliverySelect = {
  id: deliveries.id,
  eventId: deliveries.eventId,
  endpointId: deliveries.endpointId,
  endpointUrl: endpoints.url,
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
    const { status, eventId } = parseListQuery(req.query)
    const tenantId = getTenantId(req)
    const db = getDb()

    const conditions = [eq(deliveries.tenantId, tenantId)]
    if (status !== undefined) {
      conditions.push(eq(deliveries.status, status))
    }
    if (eventId !== undefined) {
      conditions.push(eq(deliveries.eventId, eventId))
    }
    const where = and(...conditions)

    const [countResult, rows] = await Promise.all([
      db.select({ value: count() }).from(deliveries).where(where),
      db
        .select(deliverySelect)
        .from(deliveries)
        .innerJoin(endpoints, eq(deliveries.endpointId, endpoints.id))
        .where(where)
        .orderBy(desc(deliveries.createdAt))
        .limit(limit)
        .offset(offset),
    ])
    const [countRow] = countResult
    const total = countRow?.value ?? 0

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
      .select(deliverySelect)
      .from(deliveries)
      .innerJoin(endpoints, eq(deliveries.endpointId, endpoints.id))
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
        attemptCount: deliveries.attemptCount,
        nextRetryAt: deliveries.nextRetryAt,
      })
      .from(deliveries)
      .where(and(eq(deliveries.id, id), eq(deliveries.tenantId, tenantId)))
      .limit(1)

    if (!existing) {
      throw new AppError(404, 'not_found', 'Delivery not found')
    }

    if (existing.status === 'pending' || existing.status === 'in_progress') {
      res.status(202).json({ id, status: existing.status })
      return
    }

    assertReplayableStatus(existing.status)

    // Snapshot history before clear so enqueue failure can restore the timeline.
    const priorAttempts = await db
      .select({
        deliveryId: deliveryAttempts.deliveryId,
        attemptNumber: deliveryAttempts.attemptNumber,
        httpStatus: deliveryAttempts.httpStatus,
        responseBody: deliveryAttempts.responseBody,
        error: deliveryAttempts.error,
        durationMs: deliveryAttempts.durationMs,
        createdAt: deliveryAttempts.createdAt,
      })
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, id))

    const replayed = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(deliveries)
        .set({
          status: 'pending',
          lastError: null,
          nextRetryAt: null,
          attemptCount: 0,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(deliveries.id, id),
            eq(deliveries.tenantId, tenantId),
            eq(deliveries.status, 'failed'),
          ),
        )
        .returning({ eventId: deliveries.eventId })

      if (!updated) {
        throw new AppError(400, 'invalid_state', 'Only failed deliveries can be replayed')
      }

      // Clear history so attempt numbers stay aligned with the reset attemptCount.
      await tx.delete(deliveryAttempts).where(eq(deliveryAttempts.deliveryId, id))

      await reevaluateEventStatus(updated.eventId, tx)
      return updated
    })

    try {
      await enqueueDeliveryJob(queue, id)
    } catch (err) {
      logger.error({ delivery_id: id, err }, 'replay_enqueue_failed')
      // Revert to failed + restore history so the client can retry replay.
      await db.transaction(async (tx) => {
        const [rolledBack] = await tx
          .update(deliveries)
          .set({
            status: 'failed',
            lastError: 'enqueue_failed',
            attemptCount: existing.attemptCount,
            nextRetryAt: existing.nextRetryAt,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(deliveries.id, id),
              eq(deliveries.tenantId, tenantId),
              eq(deliveries.status, 'pending'),
            ),
          )
          .returning({ id: deliveries.id })
        if (!rolledBack) return

        if (priorAttempts.length > 0) {
          await tx.insert(deliveryAttempts).values(priorAttempts)
        }
        await reevaluateEventStatus(replayed.eventId, tx)
      })
      throw new AppError(503, 'service_unavailable', 'Service temporarily unavailable')
    }

    res.status(202).json({ id, status: 'pending' })
  } catch (err) {
    next(err)
  }
}
