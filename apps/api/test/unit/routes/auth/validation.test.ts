import type { Request } from 'express'
import { describe, expect, it } from 'vitest'
import '../../../../src/config.js'
import { env } from '../../../../src/config.js'
import { AppError } from '../../../../src/lib/errors.js'
import {
  parseBootstrapBody,
  parseChangePasswordBody,
  parseLoginBody,
  requireAdminSecret,
} from '../../../../src/routes/auth/validation.js'

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

describe('parseLoginBody', () => {
  it('accepts a valid login payload', () => {
    expect(parseLoginBody({ email: 'owner@acme.com', password: 'secret' })).toEqual({
      email: 'owner@acme.com',
      password: 'secret',
    })
  })

  it('normalizes email addresses', () => {
    expect(parseLoginBody({ email: 'Owner@Acme.com', password: 'secret' }).email).toBe(
      'owner@acme.com',
    )
  })

  it('rejects an invalid email', () => {
    expect(() => parseLoginBody({ email: 'bad', password: 'secret' })).toThrow(AppError)
  })
})

describe('parseBootstrapBody', () => {
  it('accepts a valid bootstrap payload', () => {
    expect(
      parseBootstrapBody({
        email: 'admin@example.com',
        password: 'secure-password-min-12-chars',
        name: 'Platform Admin',
      }),
    ).toEqual({
      email: 'admin@example.com',
      password: 'secure-password-min-12-chars',
      name: 'Platform Admin',
    })
  })
})

describe('requireAdminSecret', () => {
  it('accepts the configured bootstrap secret', () => {
    expect(() => requireAdminSecret(reqWithAdminSecret(env.ADMIN_BOOTSTRAP_SECRET))).not.toThrow()
  })

  it('rejects a wrong or missing secret', () => {
    expect(() => requireAdminSecret(reqWithAdminSecret('wrong-secret'))).toThrow(AppError)
    expect(() => requireAdminSecret(reqWithAdminSecret(undefined))).toThrow(AppError)
  })
})

describe('parseChangePasswordBody', () => {
  it('accepts a valid change-password payload', () => {
    expect(
      parseChangePasswordBody({
        current_password: 'old-password-12',
        new_password: 'new-password-12',
      }),
    ).toEqual({
      current_password: 'old-password-12',
      new_password: 'new-password-12',
    })
  })
})
