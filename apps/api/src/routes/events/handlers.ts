import { deliveries, events } from '@webhook/shared/schema'
import { and, count, desc, eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { getDb } from '../../db/client.js'
import { ingestFanout } from '../../ingest/fanout.js'
import { AppError } from '../../lib/errors.js'
import { logger } from '../../lib/logger.js'
import { parsePagination } from '../../lib/pagination.js'
import { getTenantId } from '../../lib/tenant.js'
import { enqueueDelivery } from '../../queue/client.js'
import {
  type DeliveriesSummary,
  toEventDetailJson,
  toEventListJson,
  toIngestEventJson,
} from './serialize.js'
import { parseEventId, parseIngestBody } from './validation.js'

const eventColumns = {
  id: events.id,
  tenantId: events.tenantId,
  idempotencyKey: events.idempotencyKey,
  type: events.type,
  payload: events.payload,
  status: events.status,
  createdAt: events.createdAt,
}

async function loadDeliveriesSummary(
  eventId: string,
  tenantId: string,
): Promise<DeliveriesSummary> {
  const db = getDb()
  const rows = await db
    .select({
      status: deliveries.status,
      value: count(),
    })
    .from(deliveries)
    .where(and(eq(deliveries.eventId, eventId), eq(deliveries.tenantId, tenantId)))
    .groupBy(deliveries.status)

  const summary: DeliveriesSummary = {
    total: 0,
    succeeded: 0,
    failed: 0,
    pending: 0,
    deferred: 0,
  }

  for (const row of rows) {
    summary.total += row.value
    if (row.status === 'succeeded') {
      summary.succeeded = row.value
    } else if (row.status === 'failed') {
      summary.failed = row.value
    } else if (row.status === 'pending' || row.status === 'in_progress') {
      summary.pending += row.value
    } else if (row.status === 'deferred') {
      summary.deferred = row.value
    }
  }

  return summary
}

export async function ingestEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseIngestBody(req.body)
    const tenantId = getTenantId(req)
    const result = await ingestFanout(tenantId, body)

    for (const deliveryId of result.newDeliveryIds) {
      try {
        await enqueueDelivery(deliveryId)
      } catch (err) {
        logger.error({ delivery_id: deliveryId, err }, 'enqueue_failed')
        throw new AppError(503, 'service_unavailable', 'Service temporarily unavailable')
      }
    }

    if (!result.isDuplicate) {
      logger.info(
        {
          tenant_id: tenantId,
          event_id: result.event.id,
          idempotency_key: body.idempotency_key,
        },
        'ingest_event',
      )
    }

    res.status(202).json(toIngestEventJson(result.event))
  } catch (err) {
    next(err)
  }
}

export async function listEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, offset } = parsePagination(req.query)
    const tenantId = getTenantId(req)
    const db = getDb()
    const where = eq(events.tenantId, tenantId)

    const [countRow] = await db.select({ value: count() }).from(events).where(where)
    const total = countRow?.value ?? 0

    const rows = await db
      .select(eventColumns)
      .from(events)
      .where(where)
      .orderBy(desc(events.createdAt))
      .limit(limit)
      .offset(offset)

    res.json({
      data: rows.map((row) => toEventListJson(row)),
      total,
      limit,
      offset,
    })
  } catch (err) {
    next(err)
  }
}

export async function getEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseEventId(id)

    const tenantId = getTenantId(req)
    const db = getDb()
    const [row] = await db
      .select(eventColumns)
      .from(events)
      .where(and(eq(events.id, id), eq(events.tenantId, tenantId)))
      .limit(1)

    if (!row) {
      throw new AppError(404, 'not_found', 'Event not found')
    }

    const deliveriesSummary = await loadDeliveriesSummary(row.id, tenantId)
    res.json(toEventDetailJson(row, deliveriesSummary))
  } catch (err) {
    next(err)
  }
}
