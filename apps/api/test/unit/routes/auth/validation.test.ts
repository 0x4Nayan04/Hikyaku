import type { Request } from 'express'
import { describe, expect, it } from 'vitest'
import '../../../../src/config.js'
import { env } from '../../../../src/config.js'
import { AppError } from '../../../../src/lib/errors.js'
import { requireAdminSecret } from '../../../../src/routes/auth/validation.js'

function reqWithAdminSecret(secret: string | undefined): Request {
  return {
    get(name: string) {
      if (name.toLowerCase() === 'x-admin-secret') {
        return secret
      }
      return undefined
    },
  } as Request
}

describe('requireAdminSecret', () => {
  it('accepts the configured bootstrap secret', () => {
    expect(() => requireAdminSecret(reqWithAdminSecret(env.ADMIN_BOOTSTRAP_SECRET))).not.toThrow()
  })

  it('rejects a wrong or missing secret', () => {
    expect(() => requireAdminSecret(reqWithAdminSecret('wrong-secret'))).toThrow(AppError)
    expect(() => requireAdminSecret(reqWithAdminSecret(undefined))).toThrow(AppError)
  })
})
