import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { invites } from '@hikyaku/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closePool, getDb } from '../../../src/db/client.js'
import { createTenantWithKey, deleteTenant } from '../../helpers/tenant.js'
import { createUser, deleteUser } from '../../helpers/user.js'
import { AppError } from '../../../src/lib/errors.js'
import {
  assertInviteUsable,
  assertPasswordResetUsable,
  consumeInvite,
  type InviteRow,
} from '../../../src/auth/invites.js'

function makeInvite(overrides: Partial<InviteRow> = {}): InviteRow {
  return {
    id: 'invite-1',
    tokenHash: 'hash',
    kind: 'tenant_owner',
    email: 'owner@example.com',
    tenantId: null,
    tenantName: 'Acme',
    invitedName: 'Owner',
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    ...overrides,
  }
}

describe('assertInviteUsable', () => {
  it('allows a fresh unused invite', () => {
    expect(() => assertInviteUsable(makeInvite())).not.toThrow()
  })

  it('rejects an already accepted invite', () => {
    expect(() => assertInviteUsable(makeInvite({ acceptedAt: new Date() }))).toThrow(AppError)
    try {
      assertInviteUsable(makeInvite({ acceptedAt: new Date() }))
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).code).toBe('invite_used')
      expect((err as AppError).statusCode).toBe(410)
    }
  })

  it('rejects an expired invite', () => {
    try {
      assertInviteUsable(makeInvite({ expiresAt: new Date(Date.now() - 1) }))
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).code).toBe('invite_expired')
      expect((err as AppError).statusCode).toBe(410)
    }
  })
})

describe('assertPasswordResetUsable', () => {
  it('allows a fresh password reset', () => {
    expect(() => assertPasswordResetUsable(makeInvite({ kind: 'password_reset' }))).not.toThrow()
  })

  it('rejects an invite token', () => {
    expect(() => assertPasswordResetUsable(makeInvite())).toThrow(AppError)
    try {
      assertPasswordResetUsable(makeInvite())
    } catch (err) {
      expect((err as AppError).code).toBe('not_found')
      expect((err as AppError).statusCode).toBe(404)
    }
  })

  it('rejects a used reset link', () => {
    try {
      assertPasswordResetUsable(makeInvite({ kind: 'password_reset', acceptedAt: new Date() }))
    } catch (err) {
      expect((err as AppError).code).toBe('reset_used')
      expect((err as AppError).statusCode).toBe(410)
    }
  })

  it('rejects an expired reset link', () => {
    try {
      assertPasswordResetUsable(
        makeInvite({ kind: 'password_reset', expiresAt: new Date(Date.now() - 1) }),
      )
    } catch (err) {
      expect((err as AppError).code).toBe('reset_expired')
      expect((err as AppError).statusCode).toBe(410)
    }
  })
})

describe('transaction-scoped token consumption', () => {
  let tenantId: string
  let creatorId: string
  beforeAll(async () => {
    tenantId = (await createTenantWithKey()).tenantId
    creatorId = (await createUser({ tenantId })).userId
  })
  afterAll(async () => {
    await getDb().delete(invites).where(eq(invites.createdByUserId, creatorId))
    await deleteUser(creatorId)
    await deleteTenant(tenantId)
    await closePool()
  })

  async function token(kind: 'tenant_owner' | 'password_reset') {
    const [row] = await getDb()
      .insert(invites)
      .values({
        kind,
        tokenHash: randomUUID(),
        email: 'consume@example.com',
        tenantName: 'Consume Co',
        createdByUserId: creatorId,
        expiresAt: new Date(Date.now() + 60_000),
      })
      .returning()
    return row
  }

  it.each(['tenant_owner', 'password_reset'] as const)(
    'rolls back consumption and permits only one concurrent consumer for %s',
    async (kind) => {
      const invite = await token(kind)
      const failure = new Error('later business operation failed')
      await expect(
        getDb().transaction(async (tx) => {
          await consumeInvite(invite, tx)
          throw failure
        }),
      ).rejects.toBe(failure)
      const [rolledBack] = await getDb().select().from(invites).where(eq(invites.id, invite.id))
      expect(rolledBack.acceptedAt).toBeNull()

      const results = await Promise.allSettled(
        [1, 2].map(() => getDb().transaction((tx) => consumeInvite(invite, tx))),
      )
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
      const rejected = results.find((result) => result.status === 'rejected')
      expect(rejected?.status === 'rejected' && rejected.reason).toMatchObject({
        statusCode: 410,
        code: kind === 'password_reset' ? 'reset_used' : 'invite_used',
      })
    },
  )

  it.each(['tenant_owner', 'password_reset'] as const)(
    'rejects a token that expires after it was initially loaded: %s',
    async (kind) => {
      const invite = await token(kind)
      await getDb()
        .update(invites)
        .set({ expiresAt: new Date(Date.now() - 1) })
        .where(eq(invites.id, invite.id))
      await expect(getDb().transaction((tx) => consumeInvite(invite, tx))).rejects.toMatchObject({
        statusCode: 410,
        code: kind === 'password_reset' ? 'reset_expired' : 'invite_expired',
      })
    },
  )
})
