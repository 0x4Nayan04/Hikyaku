import { describe, expect, it } from 'vitest'
import {
  parseBootstrapBody,
  parseChangePasswordBody,
  parseLoginBody,
} from '../../../../src/routes/auth/validation.js'
import { AppError } from '../../../../src/lib/errors.js'

describe('parseLoginBody', () => {
  it('accepts a valid login payload', () => {
    expect(parseLoginBody({ email: 'owner@acme.com', password: 'secret' })).toEqual({
      email: 'owner@acme.com',
      password: 'secret',
    })
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
