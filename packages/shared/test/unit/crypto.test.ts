import { describe, expect, it } from 'vitest'
import { WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS } from '../../src/constants.js'
import {
  generateApiKey,
  generateInviteToken,
  hashApiKey,
  hashInviteToken,
  signPayload,
  verifyPayload,
} from '../../src/crypto.js'

describe('signPayload / verifyPayload', () => {
  const secret = 'whsec_f1e2d3c4b5a6978012345678abcdef02'
  const timestamp = 1_717_654_321
  const body = '{"id":"evt_123","type":"order.created","data":{"total":99}}'
  const fresh = { nowSeconds: timestamp }

  it('round-trips sign and verify for the same inputs', () => {
    const signature = signPayload(secret, timestamp, body)
    expect(signature.startsWith('sha256=')).toBe(true)
    expect(verifyPayload(secret, timestamp, body, signature, fresh)).toBe(true)
  })

  it('rejects a tampered body', () => {
    const signature = signPayload(secret, timestamp, body)
    expect(verifyPayload(secret, timestamp, `${body}x`, signature, fresh)).toBe(false)
  })

  it('rejects a tampered timestamp', () => {
    const signature = signPayload(secret, timestamp, body)
    expect(verifyPayload(secret, timestamp + 1, body, signature, fresh)).toBe(false)
  })

  it('rejects the wrong secret', () => {
    const signature = signPayload(secret, timestamp, body)
    expect(
      verifyPayload('whsec_wrongsecretwrongsecretwrongsecre', timestamp, body, signature, fresh),
    ).toBe(false)
  })

  it('rejects a short or garbage signature without throwing', () => {
    expect(verifyPayload(secret, timestamp, body, 'sha256=dead', fresh)).toBe(false)
    expect(verifyPayload(secret, timestamp, body, 'not-a-sig', fresh)).toBe(false)
  })

  it('rejects timestamps outside the skew window', () => {
    const signature = signPayload(secret, timestamp, body)
    expect(
      verifyPayload(secret, timestamp, body, signature, {
        nowSeconds: timestamp + WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS + 1,
      }),
    ).toBe(false)
    expect(
      verifyPayload(secret, timestamp, body, signature, {
        nowSeconds: timestamp - WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS - 1,
      }),
    ).toBe(false)
  })

  it('accepts timestamps within the skew window', () => {
    const signature = signPayload(secret, timestamp, body)
    expect(
      verifyPayload(secret, timestamp, body, signature, {
        nowSeconds: timestamp + WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
      }),
    ).toBe(true)
  })
})

describe('generateApiKey', () => {
  it('starts with whk_ and has the expected length', () => {
    const apiKey = generateApiKey()
    expect(apiKey.startsWith('whk_')).toBe(true)
    expect(apiKey).toHaveLength(36)
  })
})

describe('hashApiKey', () => {
  it('returns the same SHA-256 hex for the same input', () => {
    const apiKey = 'whk_0123456789abcdef0123456789abcdef'
    expect(hashApiKey(apiKey)).toBe(hashApiKey(apiKey))
  })
})

describe('generateInviteToken / hashInviteToken', () => {
  it('generates opaque base64url tokens', () => {
    const token = generateInviteToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token.length).toBeGreaterThanOrEqual(40)
  })

  it('hashes the same token consistently and differs across tokens', () => {
    const a = generateInviteToken()
    const b = generateInviteToken()
    expect(hashInviteToken(a)).toBe(hashInviteToken(a))
    expect(hashInviteToken(a)).not.toBe(hashInviteToken(b))
    expect(hashInviteToken(a)).toMatch(/^[a-f0-9]{64}$/)
  })
})
