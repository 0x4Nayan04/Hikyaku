import { describe, expect, it } from 'vitest'
import { AppError } from '../../../src/lib/errors.js'
import {
  assertSessionMutationOrigin,
  sessionCookiePresent,
} from '../../../src/lib/csrf.js'

describe('sessionCookiePresent', () => {
  it('detects the session cookie among others', () => {
    expect(sessionCookiePresent('sid=abc; other=1', 'sid')).toBe(true)
    expect(sessionCookiePresent('other=1; sid=abc', 'sid')).toBe(true)
    expect(sessionCookiePresent('other=1', 'sid')).toBe(false)
    expect(sessionCookiePresent(undefined, 'sid')).toBe(false)
  })
})

describe('assertSessionMutationOrigin', () => {
  const allowedOrigins = new Set(['https://app.example.com'])

  it('is a no-op when enforce is false', () => {
    expect(() =>
      assertSessionMutationOrigin({
        method: 'POST',
        origin: undefined,
        cookieHeader: 'sid=abc',
        cookieName: 'sid',
        allowedOrigins,
        enforce: false,
      }),
    ).not.toThrow()
  })

  it('allows safe methods without an Origin', () => {
    expect(() =>
      assertSessionMutationOrigin({
        method: 'GET',
        origin: undefined,
        cookieHeader: 'sid=abc',
        cookieName: 'sid',
        allowedOrigins,
        enforce: true,
      }),
    ).not.toThrow()
  })

  it('allows mutating requests without a session cookie (API keys / curl)', () => {
    expect(() =>
      assertSessionMutationOrigin({
        method: 'POST',
        origin: undefined,
        cookieHeader: undefined,
        cookieName: 'sid',
        allowedOrigins,
        enforce: true,
      }),
    ).not.toThrow()
  })

  it('allows mutating session requests from an allowlisted Origin', () => {
    expect(() =>
      assertSessionMutationOrigin({
        method: 'POST',
        origin: 'https://app.example.com',
        cookieHeader: 'sid=abc',
        cookieName: 'sid',
        allowedOrigins,
        enforce: true,
      }),
    ).not.toThrow()
  })

  it('rejects mutating session requests with a missing or foreign Origin', () => {
    expect(() =>
      assertSessionMutationOrigin({
        method: 'DELETE',
        origin: undefined,
        cookieHeader: 'sid=abc',
        cookieName: 'sid',
        allowedOrigins,
        enforce: true,
      }),
    ).toThrow(AppError)

    expect(() =>
      assertSessionMutationOrigin({
        method: 'POST',
        origin: 'https://evil.example',
        cookieHeader: 'sid=abc',
        cookieName: 'sid',
        allowedOrigins,
        enforce: true,
      }),
    ).toThrow(AppError)
  })
})
