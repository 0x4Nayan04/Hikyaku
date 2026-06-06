import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { hashApiKey } from '@webhook/shared/crypto'
import { apiKeys } from '@webhook/shared/schema'
import '../../../src/config.js'
import { resolveTenantId } from '../../../src/auth/apiKey.js'
import { closePool, getDb } from '../../../src/db/client.js'
import { createTenantWithKey, deleteTenant } from '../../helpers/tenant.js'

async function readLastUsedAt(apiKey: string): Promise<Date | null> {
  const rows = await getDb()
    .select({ lastUsedAt: apiKeys.lastUsedAt })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hashApiKey(apiKey)))
    .limit(1)

  return rows[0]?.lastUsedAt ?? null
}

describe('resolveTenantId', () => {
  afterAll(async () => {
    await closePool()
  })

  it('returns tenant id for a valid api key', async () => {
    const { tenantId, apiKey } = await createTenantWithKey()

    await expect(resolveTenantId(apiKey)).resolves.toBe(tenantId)

    await deleteTenant(tenantId)
  })

  it('returns null for an unknown api key', async () => {
    await expect(resolveTenantId('whk_00000000000000000000000000000000')).resolves.toBeNull()
  })

  it('returns null for a revoked api key', async () => {
    const { tenantId, apiKey } = await createTenantWithKey({ revoked: true })

    await expect(resolveTenantId(apiKey)).resolves.toBeNull()

    await deleteTenant(tenantId)
  })

  it('updates last_used_at after successful auth', async () => {
    const { tenantId, apiKey } = await createTenantWithKey()

    expect(await readLastUsedAt(apiKey)).toBeNull()

    await expect(resolveTenantId(apiKey)).resolves.toBe(tenantId)

    let lastUsedAt: Date | null = null
    for (let attempt = 0; attempt < 20; attempt++) {
      lastUsedAt = await readLastUsedAt(apiKey)
      if (lastUsedAt) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }

    expect(lastUsedAt).toBeInstanceOf(Date)

    await deleteTenant(tenantId)
  })

  it('does not update last_used_at for an unknown api key', async () => {
    const unknownKey = 'whk_00000000000000000000000000000000'

    await expect(resolveTenantId(unknownKey)).resolves.toBeNull()
  })
})
