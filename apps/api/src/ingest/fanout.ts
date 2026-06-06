import { deliveries, endpoints, events } from '@webhook/shared/schema'
import type { IngestEventInput } from '@webhook/shared/zod'
import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '@webhook/shared/schema'
import { getDb } from '../db/client.js'

type DbExecutor = NodePgDatabase<typeof schema>

const eventColumns = {
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

export async function ingestFanout(
  tenantId: string,
  input: IngestEventInput,
): Promise<FanoutResult> {
  const db = getDb()

  const existing = await findEvent(db, tenantId, input.idempotency_key)
  if (existing) {
    return { event: existing, newDeliveryIds: [], isDuplicate: true }
  }

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
      return { event: concurrent, newDeliveryIds: [], isDuplicate: true }
    }

    const activeEndpoints = await tx
      .select({ id: endpoints.id })
      .from(endpoints)
      .where(and(eq(endpoints.tenantId, tenantId), eq(endpoints.status, 'active')))

    const newDeliveryIds: string[] = []
    for (const endpoint of activeEndpoints) {
      const [delivery] = await tx
        .insert(deliveries)
        .values({
          tenantId,
          eventId: inserted.id,
          endpointId: endpoint.id,
        })
        .onConflictDoNothing({ target: [deliveries.eventId, deliveries.endpointId] })
        .returning({ id: deliveries.id })

      if (delivery) {
        newDeliveryIds.push(delivery.id)
      }
    }

    return { event: inserted, newDeliveryIds, isDuplicate: false }
  })
}
