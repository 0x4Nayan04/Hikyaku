import { deliveries, endpoints, events } from '@webhook/shared/schema'
import { reevaluateEventStatus } from '@webhook/shared/eventStatus'
import type { IngestEventInput } from '@webhook/shared/zod'
import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '@webhook/shared/schema'
import { isDeepStrictEqual } from 'node:util'
import { getDb } from '../db/client.js'

type DbExecutor = NodePgDatabase<typeof schema>

export const eventColumns = {
  id: events.id,
  tenantId: events.tenantId,
  idempotencyKey: events.idempotencyKey,
  type: events.type,
  payload: events.payload,
  status: events.status,
  createdAt: events.createdAt,
}

export type EventRow = typeof events.$inferSelect

export type FanoutResult = {
  event: EventRow
  newDeliveryIds: string[]
  isDuplicate: boolean
}

export class IdempotencyMismatchError extends Error {
  constructor(idempotencyKey: string) {
    super(`Idempotency key "${idempotencyKey}" was already used with a different event body`)
    this.name = 'IdempotencyMismatchError'
  }
}

async function findEvent(
  executor: DbExecutor,
  tenantId: string,
  idempotencyKey: string,
): Promise<EventRow | undefined> {
  const [row] = await executor
    .select(eventColumns)
    .from(events)
    .where(and(eq(events.tenantId, tenantId), eq(events.idempotencyKey, idempotencyKey)))
    .limit(1)

  return row
}

async function insertDeliveries(
  executor: DbExecutor,
  tenantId: string,
  eventId: string,
): Promise<string[]> {
  const activeEndpoints = await executor
    .select({ id: endpoints.id })
    .from(endpoints)
    .where(and(eq(endpoints.tenantId, tenantId), eq(endpoints.status, 'active')))

  if (activeEndpoints.length === 0) {
    return []
  }

  const inserted = await executor
    .insert(deliveries)
    .values(
      activeEndpoints.map((endpoint) => ({
        tenantId,
        eventId,
        endpointId: endpoint.id,
      })),
    )
    .onConflictDoNothing({ target: [deliveries.eventId, deliveries.endpointId] })
    .returning({ id: deliveries.id })

  return inserted.map((row) => row.id)
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
      .returning(eventColumns)

    if (!inserted) {
      const concurrent = await findEvent(tx, tenantId, input.idempotency_key)
      if (!concurrent) {
        throw new Error('event_insert_conflict_missing_row')
      }

      if (concurrent.type !== input.type || !isDeepStrictEqual(concurrent.payload, input.payload)) {
        throw new IdempotencyMismatchError(input.idempotency_key)
      }

      const newDeliveryIds = await insertDeliveries(tx, tenantId, concurrent.id)
      await reevaluateEventStatus(concurrent.id, tx)

      const updated = await findEvent(tx, tenantId, input.idempotency_key)
      if (!updated) {
        throw new Error('event_status_update_missing_row')
      }

      return { event: updated, newDeliveryIds, isDuplicate: true }
    }

    const newDeliveryIds = await insertDeliveries(tx, tenantId, inserted.id)
    if (newDeliveryIds.length === 0) {
      const [completed] = await tx
        .update(events)
        .set({ status: 'completed' })
        .where(eq(events.id, inserted.id))
        .returning(eventColumns)

      if (!completed) {
        throw new Error('event_status_update_missing_row')
      }

      return { event: completed, newDeliveryIds: [], isDuplicate: false }
    }

    return { event: inserted, newDeliveryIds, isDuplicate: false }
  })
}
