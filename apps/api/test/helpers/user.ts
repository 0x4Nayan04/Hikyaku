import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { hashPassword } from '@webhook/shared/password'
import { users } from '@webhook/shared/schema'
import { getDb } from '../../src/db/client.js'

const DEFAULT_TEST_PASSWORD = 'test-password-min-12-chars'

export async function createUser(options: {
  tenantId: string | null
  isSuperAdmin?: boolean
  email?: string
  password?: string
  name?: string
}): Promise<{ userId: string; email: string; password: string }> {
  const email = options.email ?? `user-${randomUUID()}@test.com`
  const password = options.password ?? DEFAULT_TEST_PASSWORD
  const passwordHash = await hashPassword(password)

  const [user] = await getDb()
    .insert(users)
    .values({
      tenantId: options.tenantId,
      email,
      passwordHash,
      name: options.name ?? 'Test User',
      isSuperAdmin: options.isSuperAdmin ?? false,
    })
    .returning({ id: users.id })

  return { userId: user.id, email, password }
}

export async function deleteUser(userId: string): Promise<void> {
  await getDb().delete(users).where(eq(users.id, userId))
}
