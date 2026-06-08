import { describe, expect, it } from 'vitest'
import {
  adminCreateUserSchema,
  bootstrapSchema,
  changePasswordSchema,
  loginSchema,
} from '../../src/zod.js'

describe('loginSchema', () => {
  it('accepts a valid login payload', () => {
    expect(
      loginSchema.safeParse({ email: 'owner@acme.com', password: 'any-password' }).success,
    ).toBe(true)
  })

  it('rejects a missing email', () => {
    expect(loginSchema.safeParse({ password: 'secret' }).success).toBe(false)
  })

  it('rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'secret' }).success).toBe(
      false,
    )
  })

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'owner@acme.com', password: '' }).success).toBe(false)
  })
})

describe('bootstrapSchema', () => {
  it('accepts a valid bootstrap payload', () => {
    expect(
      bootstrapSchema.safeParse({
        email: 'admin@example.com',
        password: 'secure-password-min-12-chars',
        name: 'Platform Admin',
      }).success,
    ).toBe(true)
  })

  it('rejects a password shorter than 12 characters', () => {
    expect(
      bootstrapSchema.safeParse({
        email: 'admin@example.com',
        password: 'short',
        name: 'Platform Admin',
      }).success,
    ).toBe(false)
  })

  it('rejects a blank name', () => {
    expect(
      bootstrapSchema.safeParse({
        email: 'admin@example.com',
        password: 'secure-password-min-12-chars',
        name: '   ',
      }).success,
    ).toBe(false)
  })
})

describe('changePasswordSchema', () => {
  it('accepts a valid change-password payload', () => {
    expect(
      changePasswordSchema.safeParse({
        current_password: 'old-password-12',
        new_password: 'new-password-12',
      }).success,
    ).toBe(true)
  })

  it('rejects an empty current password', () => {
    expect(
      changePasswordSchema.safeParse({
        current_password: '',
        new_password: 'new-password-12',
      }).success,
    ).toBe(false)
  })

  it('rejects a new password shorter than 12 characters', () => {
    expect(
      changePasswordSchema.safeParse({
        current_password: 'old-password-12',
        new_password: 'short',
      }).success,
    ).toBe(false)
  })
})

describe('adminCreateUserSchema', () => {
  it('accepts a valid create-user payload', () => {
    expect(
      adminCreateUserSchema.safeParse({
        email: 'teammate@acme.com',
        password: 'temporary-password-12',
        name: 'Acme Teammate',
      }).success,
    ).toBe(true)
  })

  it('rejects a missing name', () => {
    expect(
      adminCreateUserSchema.safeParse({
        email: 'teammate@acme.com',
        password: 'temporary-password-12',
      }).success,
    ).toBe(false)
  })

  it('rejects an invalid email', () => {
    expect(
      adminCreateUserSchema.safeParse({
        email: 'bad-email',
        password: 'temporary-password-12',
        name: 'Acme Teammate',
      }).success,
    ).toBe(false)
  })
})
