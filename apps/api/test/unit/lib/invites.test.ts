import { describe, expect, it } from 'vitest'
import { AppError } from '../../../src/lib/errors.js'
import { assertInviteUsable, type InviteRow } from '../../../src/lib/invites.js'

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
