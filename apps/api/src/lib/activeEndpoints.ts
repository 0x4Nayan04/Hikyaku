import { endpoints } from '@hikyaku/shared/schema'
import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '@hikyaku/shared/schema'

type DbExecutor = NodePgDatabase<typeof schema>

export async function getActiveEndpointIds(
  executor: DbExecutor,
  tenantId: string,
): Promise<string[]> {
  const rows = await executor
    .select({ id: endpoints.id })
    .from(endpoints)
    .where(and(eq(endpoints.tenantId, tenantId), eq(endpoints.status, 'active')))

  return rows.map((row) => row.id)
}
