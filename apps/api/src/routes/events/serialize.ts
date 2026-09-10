import type {
  DeliveriesSummary,
  EventDetailJson,
  EventListJson,
  IngestEventJson,
} from '@webhook/shared/apiJson'
import type { EventListRow, EventRow } from '../../ingest/fanout.js'

export type { DeliveriesSummary }

export function toIngestEventJson(row: EventListRow): IngestEventJson {
  return {
    id: row.id,
    status: row.status,
    created_at: row.createdAt.toISOString(),
  }
}

export function toEventListJson(row: EventListRow): EventListJson {
  return {
    id: row.id,
    idempotency_key: row.idempotencyKey,
    type: row.type,
    status: row.status,
    created_at: row.createdAt.toISOString(),
  }
}

export function toEventDetailJson(
  row: EventRow,
  deliveriesSummary: DeliveriesSummary,
): EventDetailJson {
  return {
    id: row.id,
    idempotency_key: row.idempotencyKey,
    type: row.type,
    payload: row.payload,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    deliveries_summary: deliveriesSummary,
  }
}
