import { describe, expect, it } from 'vitest'
import '../../../src/config.js'
import { AppError } from '../../../src/lib/errors.js'
import { assertLegacyTenantCreationAllowed } from '../../../src/routes/admin/legacy.js'

describe('assertLegacyTenantCreationAllowed', () => {
  it('allows non-production environments', () => {
    expect(() => assertLegacyTenantCreationAllowed('development')).not.toThrow()
    expect(() => assertLegacyTenantCreationAllowed('test')).not.toThrow()
  })

  it('blocks production with 410 gone', () => {
    try {
      assertLegacyTenantCreationAllowed('production')
      expect.unreachable('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect(err).toMatchObject({ statusCode: 410, code: 'gone' })
    }
  })
})
