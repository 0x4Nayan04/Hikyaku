import { sql } from 'drizzle-orm'
import { EVENT_STATUSES, type EventStatus } from './constants.js'

type DbExecutor = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
}

export async function reevaluateEventStatus(eventId: string, db: DbExecutor): Promise<EventStatus> {
  // Serialize rollups for concurrent deliveries of the same event. A separate
  // statement gets a fresh READ COMMITTED snapshot after the prior writer commits.
  await db.execute(sql`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`)
  const result = (await db.execute(sql`
    WITH summary AS (
      SELECT
        count(*) FILTER (WHERE status = 'succeeded') AS s,
        count(*) FILTER (WHERE status = 'failed') AS f,
        count(*) FILTER (WHERE status IN ('pending', 'in_progress')) AS open
      FROM deliveries
      WHERE event_id = ${eventId}
    ),
    computed AS (
      SELECT CASE
        WHEN (SELECT open FROM summary) > 0 THEN 'pending'
        WHEN (SELECT s FROM summary) = 0 AND (SELECT f FROM summary) = 0 THEN 'no_recipients'
        WHEN (SELECT s FROM summary) > 0 AND (SELECT f FROM summary) > 0 THEN 'partial_failure'
        WHEN (SELECT f FROM summary) > 0 THEN 'failed'
        ELSE 'completed'
      END AS status
    ),
    updated AS (
      UPDATE events SET status = computed.status
      FROM computed
      WHERE events.id = ${eventId}
        AND events.status IS DISTINCT FROM computed.status
      RETURNING events.status
    )
    SELECT COALESCE((SELECT status FROM updated), (SELECT status FROM computed)) AS status
  `)) as { rows?: Array<{ status?: string }> }

  const status = result.rows?.[0]?.status
  if (!EVENT_STATUSES.includes(status as EventStatus)) {
    throw new Error('event_status_update_missing_row')
  }
  return status as EventStatus
}
