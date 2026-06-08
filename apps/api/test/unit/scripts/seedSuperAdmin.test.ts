import { count, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { users } from '@webhook/shared/schema'
import '../../../src/config.js'
import { maybeSeedSuperAdmin } from '../../../src/scripts/seedSuperAdmin.js'
import { closePool, getDb } from '../../../src/db/client.js'
import { createUser, deleteUser } from '../../helpers/user.js'

const seedEnv = {
  SEED_SUPER_ADMIN_EMAIL: `seed-admin-${Date.now()}@test.com`,
  SEED_SUPER_ADMIN_PASSWORD: 'dev-password-min-12-chars',
  SEED_SUPER_ADMIN_NAME: 'Dev Admin',
} as const

describe('maybeSeedSuperAdmin', () => {
  afterAll(async () => {
    await closePool()
  })

  it('returns false when seed env vars are not set', async () => {
    await expect(maybeSeedSuperAdmin(getDb(), {})).resolves.toBe(false)
  })

  it('creates a super-admin when env is set and no users exist', async () => {
    const db = getDb()
    const [countRow] = await db.select({ value: count() }).from(users)
    if ((countRow?.value ?? 0) > 0) {
      return
    }

    await expect(maybeSeedSuperAdmin(db, seedEnv)).resolves.toBe(true)

    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        tenantId: users.tenantId,
        isSuperAdmin: users.isSuperAdmin,
      })
      .from(users)
      .where(eq(users.email, seedEnv.SEED_SUPER_ADMIN_EMAIL))

    expect(row).toMatchObject({
      email: seedEnv.SEED_SUPER_ADMIN_EMAIL,
      name: seedEnv.SEED_SUPER_ADMIN_NAME,
      tenantId: null,
      isSuperAdmin: true,
    })

    await deleteUser(row.id)
  })

  it('skips seeding when users already exist', async () => {
    const { userId } = await createUser({ tenantId: null, isSuperAdmin: true })

    await expect(maybeSeedSuperAdmin(getDb(), seedEnv)).resolves.toBe(false)

    const rows = await getDb()
      .select({ email: users.email })
      .from(users)
      .where(eq(users.email, seedEnv.SEED_SUPER_ADMIN_EMAIL))

    expect(rows).toHaveLength(0)

    await deleteUser(userId)
  })

  it('throws when seed env is invalid', async () => {
    await expect(
      maybeSeedSuperAdmin(getDb(), {
        SEED_SUPER_ADMIN_EMAIL: 'not-an-email',
        SEED_SUPER_ADMIN_PASSWORD: 'short',
      }),
    ).rejects.toThrow(/Super-admin seed env invalid/)
  })
})
