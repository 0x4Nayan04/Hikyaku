import { deliveries, deliveryOutbox, events } from '@webhook/shared/schema'
import { enqueueDeliveryJobs } from '@webhook/shared/enqueueDelivery'
import { and, count, desc, eq, inArray } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { getDb } from '../../db/client.js'
import { ingestFanout, eventDetailColumns, eventListColumns } from '../../ingest/fanout.js'
import { AppError, enqueueOr503 } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { logger } from '../../lib/logger.js'
import { paginatedJson, parsePagination, takePage } from '../../lib/pagination.js'
import { getTenantId } from '../../lib/tenant.js'
import { queue } from '../../queue/client.js'
import {
  type DeliveriesSummary,
  toEventDetailJson,
  toEventListJson,
  toIngestEventJson,
} from './serialize.js'
import { parseEventId, parseIngestBody, parseListQuery } from './validation.js'

/** Open deliveries for an event — used so idempotent ingest retries re-enqueue orphans. */
async function listOpenDeliveryIds(eventId: string, tenantId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.eventId, eventId),
        eq(deliveries.tenantId, tenantId),
        inArray(deliveries.status, ['pending', 'in_progress']),
      ),
    )
  return rows.map((row) => row.id)
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
  }

  for (const row of rows) {
    summary.total += row.value
    if (row.status === 'succeeded') {
      summary.succeeded = row.value
    } else if (row.status === 'failed') {
      summary.failed = row.value
    } else if (row.status === 'pending' || row.status === 'in_progress') {
      summary.pending += row.value
    }
  }

  return summary
}

export const ingestEvent = asyncHandler(async (req: Request, res: Response) => {
  const body = parseIngestBody(req.body)
  const tenantId = getTenantId(req)
  const result = await ingestFanout(tenantId, body)

  // Duplicate retries must re-enqueue open deliveries left behind by a prior enqueue 503.
  let deliveryIds: string[]
  if (result.newDeliveryIds.length > 0) {
    deliveryIds = result.newDeliveryIds
  } else if (result.isDuplicate) {
    deliveryIds = await listOpenDeliveryIds(result.event.id, tenantId)
  } else {
    deliveryIds = []
  }

  await enqueueOr503(
    enqueueDeliveryJobs(
      queue,
      deliveryIds.map((deliveryId) => ({ deliveryId, tenantId })),
    ),
    { delivery_ids: deliveryIds },
    'enqueue_failed',
  )

  if (deliveryIds.length > 0) {
    await getDb().delete(deliveryOutbox).where(inArray(deliveryOutbox.deliveryId, deliveryIds))
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
})

export const listEvents = asyncHandler(async (req: Request, res: Response) => {
  const { limit, offset } = parsePagination(req.query)
  const { status } = parseListQuery(req.query)
  const tenantId = getTenantId(req)
  const db = getDb()
  const conditions = [eq(events.tenantId, tenantId)]
  if (status !== undefined) {
    conditions.push(eq(events.status, status))
  }
  const where = and(...conditions)

  const rows = await db
    .select(eventListColumns)
    .from(events)
    .where(where)
    .orderBy(desc(events.createdAt))
    .limit(limit + 1)
    .offset(offset)
  const page = takePage(rows, limit)

  res.json(
    paginatedJson(
      page.data.map((row) => toEventListJson(row)),
      page.hasMore,
      limit,
      offset,
    ),
  )
})

export const getEvent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  parseEventId(id)

  const tenantId = getTenantId(req)
  const db = getDb()
  const [eventRows, deliveriesSummary] = await Promise.all([
    db
      .select(eventDetailColumns)
      .from(events)
      .where(and(eq(events.id, id), eq(events.tenantId, tenantId)))
      .limit(1),
    loadDeliveriesSummary(id, tenantId),
  ])
  const [row] = eventRows

  if (!row) {
    throw new AppError(404, 'not_found', 'Event not found')
  }

  res.json(toEventDetailJson(row, deliveriesSummary))
})
