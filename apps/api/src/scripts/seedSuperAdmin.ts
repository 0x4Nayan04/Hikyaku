import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '@webhook/shared/schema'
import { users } from '@webhook/shared/schema'
import { bootstrapSchema } from '@webhook/shared/zod'
import { hashPassword } from '@webhook/shared/password'
import { userEmailMatches } from '../lib/invites.js'

type SeedDb = NodePgDatabase<typeof schema>

export type SeedSuperAdminEnv = {
  SEED_SUPER_ADMIN_EMAIL?: string
  SEED_SUPER_ADMIN_PASSWORD?: string
  SEED_SUPER_ADMIN_NAME?: string
}

export async function maybeSeedSuperAdmin(
  db: SeedDb,
  source: SeedSuperAdminEnv = process.env,
): Promise<boolean> {
  const email = source.SEED_SUPER_ADMIN_EMAIL?.trim()
  const password = source.SEED_SUPER_ADMIN_PASSWORD
  const name = source.SEED_SUPER_ADMIN_NAME?.trim() || 'Platform Admin'

  if (!email || !password) {
    return false
  }

  const parsed = bootstrapSchema.safeParse({ email, password, name })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid super-admin seed env'
    throw new Error(`Super-admin seed env invalid: ${message}`)
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(userEmailMatches(parsed.data.email))
    .limit(1)

  if (existing) {
    console.log(`Super-admin seed skipped: ${parsed.data.email} already exists`)
    return false
  }

  const passwordHash = await hashPassword(parsed.data.password)

  await db.insert(users).values({
    email: parsed.data.email,
    passwordHash,
    name: parsed.data.name,
    isSuperAdmin: true,
    tenantId: null,
  })

  console.log('Super-admin seeded')
  return true
}
