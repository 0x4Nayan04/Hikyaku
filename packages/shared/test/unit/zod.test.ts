import { describe, expect, it } from 'vitest'
import {
  bootstrapSchema,
  changePasswordSchema,
  ingestEventSchema,
  loginSchema,
} from '../../src/zod.js'

describe('loginSchema', () => {
  it('accepts a valid login payload', () => {
    expect(
      loginSchema.safeParse({ email: 'owner@acme.com', password: 'any-password' }).success,
    ).toBe(true)
  })

  it('normalizes email addresses', () => {
    expect(loginSchema.parse({ email: ' Owner@Acme.com ', password: 'any-password' }).email).toBe(
      'owner@acme.com',
    )
  })

  it('rejects a missing email', () => {
    expect(loginSchema.safeParse({ password: 'secret' }).success).toBe(false)
  })

  it('rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'secret' }).success).toBe(false)
  })

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'owner@acme.com', password: '' }).success).toBe(false)
  })
})

describe('ingestEventSchema', () => {
  const event = { idempotency_key: 'event-1', type: 'test.event', payload: { value: 1 } }

  it.each([{ value: Infinity }, { value: -0 }])('rejects non-canonical JSON numbers', (payload) => {
    expect(ingestEventSchema.safeParse({ ...event, payload }).success).toBe(false)
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

  it('rejects passwords longer than 128 UTF-8 bytes', () => {
    expect(
      bootstrapSchema.safeParse({
        email: 'admin@example.com',
        password: '😀'.repeat(33),
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
