import type { ReplayDeliveryJson } from '@webhook/shared/apiJson'
import { enqueueDeliveryJob } from '@webhook/shared/enqueueDelivery'
import { reevaluateEventStatus } from '@webhook/shared/eventStatus'
import { deliveries, deliveryAttempts, deliveryOutbox, endpoints } from '@webhook/shared/schema'
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import type { Request, RequestHandler, Response } from 'express'
import { getDb } from '../../db/client.js'
import { AppError, enqueueOr503 } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { paginatedJson, parsePagination, takePage } from '../../lib/pagination.js'
import { getTenantId } from '../../lib/tenant.js'
import { queue } from '../../queue/client.js'
import { toDeliveryDetailJson, toDeliveryListJson } from './serialize.js'
import { parseDeliveryId, parseListQuery } from './validation.js'

const deliverySelect = {
  id: deliveries.id,
  eventId: deliveries.eventId,
  endpointId: deliveries.endpointId,
  endpointUrl: endpoints.url,
  endpointStatus: endpoints.status,
  status: deliveries.status,
  attemptCount: deliveries.attemptCount,
  replayCount: deliveries.replayCount,
  nextRetryAt: deliveries.nextRetryAt,
  lastError: deliveries.lastError,
  createdAt: deliveries.createdAt,
  updatedAt: deliveries.updatedAt,
}

const attemptColumns = {
  attemptNumber: deliveryAttempts.attemptNumber,
  runNumber: deliveryAttempts.runNumber,
  httpStatus: deliveryAttempts.httpStatus,
  responseBody: deliveryAttempts.responseBody,
  error: deliveryAttempts.error,
  durationMs: deliveryAttempts.durationMs,
  createdAt: deliveryAttempts.createdAt,
}

export const listDeliveries: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
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

  const rows = await db
    .select(deliverySelect)
    .from(deliveries)
    .innerJoin(endpoints, eq(deliveries.endpointId, endpoints.id))
    .where(where)
    .orderBy(desc(deliveries.createdAt))
    .limit(limit + 1)
    .offset(offset)
  const page = takePage(rows, limit)

  res.json(
    paginatedJson(
      page.data.map((row) => toDeliveryListJson(row)),
      page.hasMore,
      limit,
      offset,
    ),
  )
})

export const getDelivery: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  parseDeliveryId(id)

  const tenantId = getTenantId(req)
  const db = getDb()
  const [deliveryRows, attempts] = await Promise.all([
    db
      .select(deliverySelect)
      .from(deliveries)
      .innerJoin(endpoints, eq(deliveries.endpointId, endpoints.id))
      .where(and(eq(deliveries.id, id), eq(deliveries.tenantId, tenantId)))
      .limit(1),
    db
      .select(attemptColumns)
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, id))
      .orderBy(asc(deliveryAttempts.runNumber), asc(deliveryAttempts.attemptNumber)),
  ])
  const [row] = deliveryRows

  if (!row) {
    throw new AppError(404, 'not_found', 'Delivery not found')
  }

  res.json(toDeliveryDetailJson(row, attempts))
})

export const replayDelivery: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  parseDeliveryId(id)

  const tenantId = getTenantId(req)
  const db = getDb()

  const [existing] = await db
    .select({
      status: deliveries.status,
      endpointStatus: endpoints.status,
    })
    .from(deliveries)
    .innerJoin(endpoints, eq(deliveries.endpointId, endpoints.id))
    .where(and(eq(deliveries.id, id), eq(deliveries.tenantId, tenantId)))
    .limit(1)

  if (!existing) {
    throw new AppError(404, 'not_found', 'Delivery not found')
  }

  const canReplay =
    existing.status === 'failed' ||
    existing.status === 'pending' ||
    existing.status === 'in_progress'

  if (!canReplay) {
    throw new AppError(400, 'invalid_state', 'Only failed deliveries can be replayed')
  }

  if (existing.endpointStatus === 'disabled') {
    throw new AppError(400, 'invalid_state', 'Endpoint is disabled')
  }

  if (existing.status === 'failed') {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(deliveries)
        .set({
          status: 'pending',
          lastError: null,
          nextRetryAt: null,
          attemptCount: 0,
          replayCount: sql`${deliveries.replayCount} + 1`,
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

      await reevaluateEventStatus(updated.eventId, tx)
      await tx.insert(deliveryOutbox).values({ deliveryId: id, tenantId }).onConflictDoNothing()
    })
  }

  await enqueueOr503(
    enqueueDeliveryJob(queue, id, tenantId),
    { delivery_id: id },
    'replay_enqueue_failed',
  )

  await getDb()
    .delete(deliveryOutbox)
    .where(inArray(deliveryOutbox.deliveryId, [id]))

  const body: ReplayDeliveryJson = {
    id,
    status: existing.status === 'in_progress' ? existing.status : 'pending',
  }
  res.status(202).json(body)
})
