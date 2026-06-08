import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../../../src/auth/password.js'

describe('hashPassword', () => {
  it('returns a bcrypt hash with cost factor 12', async () => {
    const hash = await hashPassword('secure-password-min-12-chars')
    expect(hash).toMatch(/^\$2[aby]\$12\$/)
    expect(hash).toHaveLength(60)
  })

  it('produces different hashes for the same input', async () => {
    const password = 'secure-password-min-12-chars'
    const a = await hashPassword(password)
    const b = await hashPassword(password)
    expect(a).not.toBe(b)
  })
})

describe('verifyPassword', () => {
  it('returns true when the password matches the hash', async () => {
    const password = 'secure-password-min-12-chars'
    const hash = await hashPassword(password)
    await expect(verifyPassword(password, hash)).resolves.toBe(true)
  })

  it('returns false when the password does not match the hash', async () => {
    const hash = await hashPassword('secure-password-min-12-chars')
    await expect(verifyPassword('wrong-password-12', hash)).resolves.toBe(false)
  })
})
