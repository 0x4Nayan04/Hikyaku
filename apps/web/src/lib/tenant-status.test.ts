import { describe, expect, it } from 'vitest'
import { isTenantSuspended } from './tenant-status'

describe('isTenantSuspended', () => {
  it('is false when session or tenant is missing', () => {
    expect(isTenantSuspended(null)).toBe(false)
    expect(isTenantSuspended(undefined)).toBe(false)
    expect(isTenantSuspended({ tenant: null })).toBe(false)
  })

  it('is false for an active tenant', () => {
    expect(
      isTenantSuspended({
        tenant: { id: 't1', name: 'Acme', status: 'active' },
      }),
    ).toBe(false)
  })

  it('is true for a suspended tenant', () => {
    expect(
      isTenantSuspended({
        tenant: { id: 't1', name: 'Acme', status: 'suspended' },
      }),
    ).toBe(true)
  })
})
