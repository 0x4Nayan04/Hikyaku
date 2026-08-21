import { endpoints } from '@webhook/shared/schema'
import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '@webhook/shared/schema'
import { CACHE_TTL_MS, createTtlCache } from './ttlCache.js'

const cache = createTtlCache<string[]>(CACHE_TTL_MS)

type DbExecutor = NodePgDatabase<typeof schema>

export function invalidateActiveEndpointIds(tenantId: string): void {
  cache.delete(tenantId)
}

export function clearActiveEndpointCache(): void {
  cache.clear()
}

export async function getActiveEndpointIds(
  executor: DbExecutor,
  tenantId: string,
): Promise<string[]> {
  const hit = cache.get(tenantId)
  if (hit) return hit

  const rows = await executor
    .select({ id: endpoints.id })
    .from(endpoints)
    .where(and(eq(endpoints.tenantId, tenantId), eq(endpoints.status, 'active')))

  const ids = rows.map((row) => row.id)
  cache.set(tenantId, ids)
  return ids
}
