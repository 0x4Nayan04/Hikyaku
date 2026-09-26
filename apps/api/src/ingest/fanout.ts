import { reevaluateEventStatus } from '@webhook/shared/eventStatus'
import type * as schema from '@webhook/shared/schema'
import { deliveries, deliveryOutbox, events } from '@webhook/shared/schema'
import type { IngestEventInput } from '@webhook/shared/zod'
import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { isDeepStrictEqual } from 'node:util'
import { getDb } from '../db/client.js'
import { getActiveEndpointIds } from '../lib/activeEndpoints.js'
import { AppError } from '../lib/errors.js'

type DbExecutor = NodePgDatabase<typeof schema>

export const eventListColumns = {
  id: events.id,
  tenantId: events.tenantId,
  idempotencyKey: events.idempotencyKey,
  type: events.type,
  status: events.status,
  createdAt: events.createdAt,
}

export const eventDetailColumns = {
  ...eventListColumns,
  payload: events.payload,
}

export type EventListRow = Omit<typeof events.$inferSelect, 'payload'>
export type EventRow = typeof events.$inferSelect

type FanoutResult = {
  event: EventListRow
  newDeliveryIds: string[]
  isDuplicate: boolean
}

async function findEvent(
  executor: DbExecutor,
  tenantId: string,
  idempotencyKey: string,
): Promise<EventRow | undefined> {
  const [row] = await executor
    .select(eventDetailColumns)
    .from(events)
    .where(and(eq(events.tenantId, tenantId), eq(events.idempotencyKey, idempotencyKey)))
    .limit(1)

  return row
}

function toListRow(row: EventRow, status: EventListRow['status']): EventListRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    idempotencyKey: row.idempotencyKey,
    type: row.type,
    status,
    createdAt: row.createdAt,
  }
}

async function insertDeliveries(
  executor: DbExecutor,
  tenantId: string,
  eventId: string,
): Promise<string[]> {
  const endpointIds = await getActiveEndpointIds(executor, tenantId)

  if (endpointIds.length === 0) {
    return []
  }

  const inserted = await executor
    .insert(deliveries)
    .values(
      endpointIds.map((endpointId) => ({
        tenantId,
        eventId,
        endpointId,
      })),
    )
    .onConflictDoNothing({ target: [deliveries.eventId, deliveries.endpointId] })
    .returning({ id: deliveries.id })

  const ids = inserted.map((row) => row.id)
  if (ids.length > 0) {
    await executor.insert(deliveryOutbox).values(ids.map((deliveryId) => ({ deliveryId, tenantId })))
  }

  return ids
}

export async function ingestFanout(
  tenantId: string,
  input: IngestEventInput,
): Promise<FanoutResult> {
  const db = getDb()

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(events)
      .values({
        tenantId,
        idempotencyKey: input.idempotency_key,
        type: input.type,
        payload: input.payload,
      })
      .onConflictDoNothing({ target: [events.tenantId, events.idempotencyKey] })
      .returning(eventListColumns)

    if (!inserted) {
      const concurrent = await findEvent(tx, tenantId, input.idempotency_key)
      if (!concurrent) {
        throw new Error('event_insert_conflict_missing_row')
      }

      if (concurrent.type !== input.type || !isDeepStrictEqual(concurrent.payload, input.payload)) {
        throw new AppError(
          409,
          'idempotency_mismatch',
          `Idempotency key "${input.idempotency_key}" was already used with a different event body`,
        )
      }

      const newDeliveryIds = await insertDeliveries(tx, tenantId, concurrent.id)
      const status = await reevaluateEventStatus(concurrent.id, tx)

      return { event: toListRow(concurrent, status), newDeliveryIds, isDuplicate: true }
    }

    const newDeliveryIds = await insertDeliveries(tx, tenantId, inserted.id)
    const status = await reevaluateEventStatus(inserted.id, tx)

    return { event: { ...inserted, status }, newDeliveryIds, isDuplicate: false }
  })
}
