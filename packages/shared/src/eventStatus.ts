import { sql } from 'drizzle-orm'

type DbExecutor = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
}

export async function reevaluateEventStatus(eventId: string, db: DbExecutor): Promise<void> {
  await db.execute(sql`
    WITH summary AS (
      SELECT
        count(*) FILTER (WHERE status = 'succeeded') AS s,
        count(*) FILTER (WHERE status = 'failed') AS f,
        count(*) FILTER (WHERE status IN ('pending', 'in_progress')) AS open
      FROM deliveries
      WHERE event_id = ${eventId}
    )
    UPDATE events SET status = CASE
      WHEN (SELECT open FROM summary) > 0 THEN 'pending'
      WHEN (SELECT s FROM summary) = 0 AND (SELECT f FROM summary) > 0 THEN 'failed'
      ELSE 'completed'
    END
    WHERE id = ${eventId}
  `)
}
