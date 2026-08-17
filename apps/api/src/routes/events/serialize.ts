import type { EventListRow, EventRow } from '../../ingest/fanout.js'

export type DeliveriesSummary = {
  total: number
  succeeded: number
  failed: number
  pending: number
}

export function toIngestEventJson(row: EventListRow) {
  return {
    id: row.id,
    status: row.status,
    created_at: row.createdAt.toISOString(),
  }
}

export function toEventListJson(row: EventListRow) {
  return {
    id: row.id,
    idempotency_key: row.idempotencyKey,
    type: row.type,
    status: row.status,
    created_at: row.createdAt.toISOString(),
  }
}

export function toEventDetailJson(row: EventRow, deliveriesSummary: DeliveriesSummary) {
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
