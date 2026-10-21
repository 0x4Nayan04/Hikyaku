import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { hashApiKey } from '@hikyaku/shared/crypto'
import { apiKeys, tenants } from '@hikyaku/shared/schema'
import { assertWritable } from './readOnly.js'
import { getDb } from '../db/client.js'
import { logger } from '../lib/logger.js'

const LAST_USED_AT_UPDATE_INTERVAL_MS = 60 * 60 * 1000

function touchLastUsedAt(keyHash: string, cutoff: Date): void {
  void getDb()
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        or(isNull(apiKeys.lastUsedAt), lt(apiKeys.lastUsedAt, cutoff)),
      ),
    )
    .catch((err: unknown) => {
      logger.warn({ err }, 'last_used_at_update_failed')
    })
}

export async function resolveTenantId(apiKey: string): Promise<string | null> {
  const keyHash = hashApiKey(apiKey)
  const rows = await getDb()
    .select({
      tenantId: apiKeys.tenantId,
      lastUsedAt: apiKeys.lastUsedAt,
      readOnly: tenants.readOnly,
    })
    .from(apiKeys)
    .innerJoin(tenants, eq(apiKeys.tenantId, tenants.id))
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1)

  const key = rows[0]
  const tenantId = key?.tenantId
  if (!tenantId) {
    return null
  }
  assertWritable(key.readOnly)
  const cutoff = new Date(Date.now() - LAST_USED_AT_UPDATE_INTERVAL_MS)
  if (!key.lastUsedAt || key.lastUsedAt < cutoff) {
    touchLastUsedAt(keyHash, cutoff)
  }
  return tenantId
}
