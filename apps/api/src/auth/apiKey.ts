import { and, eq, isNull } from 'drizzle-orm'
import { hashApiKey } from '@webhook/shared/crypto'
import { apiKeys } from '@webhook/shared/schema'
import { getDb } from '../db/client.js'

export async function resolveTenantId(apiKey: string): Promise<string | null> {
  const keyHash = hashApiKey(apiKey)

  const rows = await getDb()
    .select({ tenantId: apiKeys.tenantId })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1)

  return rows[0]?.tenantId ?? null
}
