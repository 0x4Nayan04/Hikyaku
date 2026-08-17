import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '@webhook/shared/schema'
import { getDb } from '../db/client.js'

type DbExecutor = NodePgDatabase<typeof schema>

/** Drops every persisted session for the user (password change / admin reset). */
export async function revokeUserSessions(userId: string, executor?: DbExecutor): Promise<void> {
  const db = executor ?? getDb()
  await db.execute(sql`DELETE FROM sessions WHERE sess->>'userId' = ${userId}`)
}

/** Drops every persisted session for users in the tenant before tenant deletion. */
export async function revokeTenantSessions(tenantId: string, executor?: DbExecutor): Promise<void> {
  const db = executor ?? getDb()
  await db.execute(sql`
    DELETE FROM sessions
    WHERE sess->>'userId' IN (
      SELECT id::text FROM users WHERE tenant_id = ${tenantId}
    )
  `)
}

/** Keeps denormalized tenant names in session blobs in sync after an admin rename. */
export async function refreshTenantNameInSessions(
  tenantId: string,
  tenantName: string,
  executor?: DbExecutor,
): Promise<void> {
  const db = executor ?? getDb()
  await db.execute(sql`
    UPDATE sessions
    SET sess = jsonb_set(sess::jsonb, '{tenantName}', to_jsonb(${tenantName}::text))
    WHERE sess->>'tenantId' = ${tenantId}
  `)
}
