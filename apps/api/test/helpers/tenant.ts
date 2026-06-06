import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { generateApiKey, hashApiKey, prefixOf } from '@webhook/shared/crypto'
import { apiKeys, tenants } from '@webhook/shared/schema'
import { getDb } from '../../src/db/client.js'

export async function createTenantWithKey(options?: { revoked?: boolean }): Promise<{
  tenantId: string
  apiKey: string
}> {
  const apiKey = generateApiKey()
  const db = getDb()

  const [tenant] = await db
    .insert(tenants)
    .values({ name: `test-${randomUUID()}` })
    .returning({ id: tenants.id })

  await db.insert(apiKeys).values({
    tenantId: tenant.id,
    keyHash: hashApiKey(apiKey),
    prefix: prefixOf(apiKey),
    revokedAt: options?.revoked ? new Date() : null,
  })

  return { tenantId: tenant.id, apiKey }
}

export async function deleteTenant(tenantId: string): Promise<void> {
  const db = getDb()
  await db.delete(apiKeys).where(eq(apiKeys.tenantId, tenantId))
  await db.delete(tenants).where(eq(tenants.id, tenantId))
}
