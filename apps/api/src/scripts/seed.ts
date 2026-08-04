import { generateApiKey, hashApiKey, prefixOf } from '@webhook/shared/crypto'
import { hashPassword } from '@webhook/shared/password'
import { apiKeys, tenants, users } from '@webhook/shared/schema'
import { eq } from 'drizzle-orm'
import '../config.js'
import { closePool, getDb } from '../db/client.js'
import { maybeSeedSuperAdmin } from './seedSuperAdmin.js'

/** Local-only demo tenants. Password meets min-12 validation. */
const SEED_TENANTS = [
  {
    name: 'Acme',
    email: 'acme@localhost',
    password: 'dev-password-min-12-chars',
  },
  {
    name: 'Globex',
    email: 'globex@localhost',
    password: 'dev-password-min-12-chars',
  },
] as const

async function seed(): Promise<void> {
  const db = getDb()

  await maybeSeedSuperAdmin(db)

  for (const { name, email, password } of SEED_TENANTS) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existing) {
      console.log(`Tenant user already exists: ${email} — skip`)
      continue
    }

    const apiKey = generateApiKey()
    const passwordHash = await hashPassword(password)

    await db.transaction(async (tx) => {
      const [tenant] = await tx.insert(tenants).values({ name }).returning({
        id: tenants.id,
      })

      await tx.insert(users).values({
        tenantId: tenant.id,
        email,
        passwordHash,
        name: `${name} Owner`,
        isSuperAdmin: false,
      })

      await tx.insert(apiKeys).values({
        tenantId: tenant.id,
        keyHash: hashApiKey(apiKey),
        prefix: prefixOf(apiKey),
      })
    })

    console.log(`Tenant seeded: ${name}`)
    console.log(`  login: ${email} / ${password}`)
    console.log(`  api key (save now; not shown again): ${apiKey}`)
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
