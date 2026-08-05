import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../../src/password.js'

describe('hashPassword', () => {
  it('returns a bcrypt hash with cost factor 12', async () => {
    const hash = await hashPassword('secure-password-min-12-chars')
    expect(hash).toMatch(/^sha256:\$2[aby]\$12\$/)
    expect(hash).toHaveLength(67)
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

  it('uses every byte of a long password', async () => {
    const prefix = 'a'.repeat(72)
    const hash = await hashPassword(`${prefix}first-suffix`)
    await expect(verifyPassword(`${prefix}second-suffix`, hash)).resolves.toBe(false)
  })

  it('continues to verify legacy bcrypt hashes', async () => {
    const legacyHash = '$2b$12$.wRm2NfWJQM9zrSx.4kvleK8cfh2Qb4GGxTtHrzmFVsR3c8q6mutO'
    await expect(verifyPassword('hikyaku-invalid-password', legacyHash)).resolves.toBe(true)
  })
})
