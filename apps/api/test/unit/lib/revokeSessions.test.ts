import { afterAll, describe, expect, it } from 'vitest'
import { sessions } from '@webhook/shared/schema'
import { eq } from 'drizzle-orm'
import '../../../src/config.js'
import { closePool, getDb } from '../../../src/db/client.js'
import { revokeUserSessions } from '../../../src/lib/revokeSessions.js'
import { createUser, deleteUser } from '../../helpers/user.js'
import { createTenantWithKey, deleteTenant } from '../../helpers/tenant.js'

describe('revokeUserSessions', () => {
  afterAll(async () => {
    await closePool()
  })

  it('deletes only sessions belonging to the target user', async () => {
    const { tenantId } = await createTenantWithKey()
    const a = await createUser({ tenantId, email: `revoke-a-${Date.now()}@test.com` })
    const b = await createUser({ tenantId, email: `revoke-b-${Date.now()}@test.com` })
    const db = getDb()

    try {
      await db.insert(sessions).values([
        {
          sid: `sid-a-${a.userId}`,
          sess: { cookie: {}, userId: a.userId },
          expire: new Date(Date.now() + 60_000),
        },
        {
          sid: `sid-b-${b.userId}`,
          sess: { cookie: {}, userId: b.userId },
          expire: new Date(Date.now() + 60_000),
        },
      ])

      await revokeUserSessions(a.userId)

      const remainingA = await db.select().from(sessions).where(eq(sessions.sid, `sid-a-${a.userId}`))
      const remainingB = await db.select().from(sessions).where(eq(sessions.sid, `sid-b-${b.userId}`))

      expect(remainingA).toHaveLength(0)
      expect(remainingB).toHaveLength(1)
    } finally {
      await db.delete(sessions).where(eq(sessions.sid, `sid-a-${a.userId}`)).catch(() => undefined)
      await db.delete(sessions).where(eq(sessions.sid, `sid-b-${b.userId}`)).catch(() => undefined)
      await deleteUser(a.userId)
      await deleteUser(b.userId)
      await deleteTenant(tenantId)
    }
  })
})
