import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import * as schema from '@webhook/shared/schema'
import { auditLog } from '@webhook/shared/schema'

type Db = NodePgDatabase<typeof schema>
type Tx = PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>
type DbExecutor = Db | Tx

type AuditAction =
  | 'tenant.created'
  | 'tenant.deleted'
  | 'tenant.renamed'
  | 'signup.approved'
  | 'signup.rejected'

export async function recordAudit(
  db: DbExecutor,
  action: AuditAction,
  actorId: string,
  tenantId: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLog).values({
    action,
    actorId,
    tenantId,
    metadata: metadata ?? null,
  })
}
