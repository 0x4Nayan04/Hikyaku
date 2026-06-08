import { generateApiKey, hashApiKey, prefixOf } from '@webhook/shared/crypto'
import { apiKeys, tenants } from '@webhook/shared/schema'
import '../config.js'
import { closePool, getDb } from '../db/client.js'
import { maybeSeedSuperAdmin } from './seedSuperAdmin.js'

const SEED_TENANTS = [{ name: 'Acme' }, { name: 'Globex' }] as const

async function seed(): Promise<void> {
  const db = getDb()

  await maybeSeedSuperAdmin(db)

  for (const { name } of SEED_TENANTS) {
    const apiKey = generateApiKey()

    const [tenant] = await db.insert(tenants).values({ name }).returning({
      id: tenants.id,
    })

    await db.insert(apiKeys).values({
      tenantId: tenant.id,
      keyHash: hashApiKey(apiKey),
      prefix: prefixOf(apiKey),
    })

    console.log(`Tenant: ${name}\nAPI Key: ${apiKey}\n`)
  }
}

seed()
  .catch((err: unknown) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await closePool()
  })
