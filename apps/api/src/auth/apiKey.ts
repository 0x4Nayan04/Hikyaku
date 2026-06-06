import { and, eq, isNull } from 'drizzle-orm'
import { hashApiKey } from '@webhook/shared/crypto'
import { apiKeys } from '@webhook/shared/schema'
import { getDb } from '../db/client.js'
import { logger } from '../lib/logger.js'

function touchLastUsedAt(keyHash: string): void {
  getDb()
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.keyHash, keyHash))
    .catch((err: unknown) => {
      logger.warn({ err }, 'last_used_at_update_failed')
    })
}

export async function resolveTenantId(apiKey: string): Promise<string | null> {
  const keyHash = hashApiKey(apiKey)

  const rows = await getDb()
    .select({ tenantId: apiKeys.tenantId })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1)

  const tenantId = rows[0]?.tenantId
  if (!tenantId) {
    return null
  }

  touchLastUsedAt(keyHash)
  return tenantId
}
