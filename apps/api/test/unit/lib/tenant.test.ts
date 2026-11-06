import type { Request } from 'express'
import { describe, expect, it } from 'vitest'
import { missingSessionError, missingTenantAuthError } from '../../../src/auth/errors.js'
import { AppError } from '../../../src/lib/errors.js'
import { getTenantId } from '../../../src/lib/tenant.js'

describe('authentication errors', () => {
  it('preserves the session and tenant authentication error envelopes', () => {
    expect(missingSessionError()).toMatchObject({
      statusCode: 401,
      code: 'unauthorized',
      message: 'Missing or invalid session',
    })
    expect(missingTenantAuthError()).toMatchObject({
      statusCode: 401,
      code: 'unauthorized',
      message: 'Missing or invalid Bearer token or session',
    })
  })

  it('returns the tenant id or throws the tenant authentication error', () => {
    expect(getTenantId({ tenantId: 'tenant-id' } as Request)).toBe('tenant-id')
    try {
      getTenantId({} as Request)
      throw new Error('expected getTenantId to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect(error).toMatchObject({
        statusCode: 401,
        code: 'unauthorized',
        message: 'Missing or invalid Bearer token or session',
      })
    }
  })
})
