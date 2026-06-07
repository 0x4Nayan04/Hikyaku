import { sql, type ExtractTablesWithRelations } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '@webhook/shared/schema'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'
import { getDb } from './db/client.js'

type Db = NodePgDatabase<typeof schema>
type Tx = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>
type DbExecutor = Db | Tx

export async function reevaluateEventStatus(eventId: string, tx?: DbExecutor): Promise<void> {
  const db = tx ?? getDb()
  await db.execute(sql`
    WITH summary AS (
      SELECT
        count(*) FILTER (WHERE status = 'succeeded') AS s,
        count(*) FILTER (WHERE status = 'failed') AS f,
        count(*) FILTER (WHERE status IN ('pending', 'in_progress', 'deferred')) AS open
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
