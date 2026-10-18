import { describe, expect, it, vi } from 'vitest'

vi.mock('connect-pg-simple', () => ({
  default: () =>
    function PgSession() {
      return {}
    },
}))

vi.mock('express-session', () => ({
  default: (options: { cookie?: { sameSite?: string; secure?: boolean } }) => options,
}))

vi.mock('../../../src/db/client.js', () => ({
  getPool: () => ({}),
}))

vi.mock('../../../src/config.js', () => ({
  env: {
    SESSION_SECRET: 'test-session-secret-min-32-characters',
    SESSION_COOKIE_MAX_AGE: 604_800_000,
    NODE_ENV: 'production',
  },
}))

describe('createSessionMiddleware cookie options', () => {
  it('uses SameSite=None and Secure in production', async () => {
    const { createSessionMiddleware } = await import('../../../src/auth/session.js')
    const options = createSessionMiddleware() as unknown as {
      cookie: { sameSite: string; secure: boolean; httpOnly: boolean }
    }

    expect(options.cookie).toMatchObject({
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    })
  })
})

describe('session user blob', () => {
  it('reads a complete blob and ignores incomplete or legacy sessions', async () => {
    const { createCredentialFingerprint, readSessionUserBlob, writeSessionUser } = await import(
      '../../../src/auth/session.js'
    )

    expect(readSessionUserBlob({ userId: 'u1' })).toBeNull()
    expect(
      readSessionUserBlob({
        userId: 'u1',
        email: 'a@b.com',
        name: 'Ada',
        tenantId: 't1',
        isSuperAdmin: false,
        tenantName: 'Acme',
      }),
    ).toBeNull()

    const fingerprint = createCredentialFingerprint('sha256:$2b$12$example')
    const session: {
      userId?: string
      email?: string
      name?: string
      tenantId?: string | null
      isSuperAdmin?: boolean
      tenantName?: string | null
      credentialFingerprint?: string
    } = {}
    writeSessionUser(session, {
      userId: 'u1',
      email: 'a@b.com',
      name: 'Ada',
      tenantId: 't1',
      isSuperAdmin: false,
      tenantName: 'Acme',
      credentialFingerprint: fingerprint,
    })
    expect(readSessionUserBlob(session)).toEqual({
      userId: 'u1',
      email: 'a@b.com',
      name: 'Ada',
      tenantId: 't1',
      isSuperAdmin: false,
      tenantName: 'Acme',
      credentialFingerprint: fingerprint,
    })
  })

  it('creates a stable server-side fingerprint from the password hash', async () => {
    const { createCredentialFingerprint } = await import('../../../src/auth/session.js')
    const hash = 'sha256:$2b$12$example-hash-value'
    expect(createCredentialFingerprint(hash)).toBe(createCredentialFingerprint(hash))
    expect(createCredentialFingerprint(hash)).not.toBe(hash)
    expect(createCredentialFingerprint(hash)).not.toBe(createCredentialFingerprint(`${hash}-x`))
  })
})

describe('shouldSkipSessionStack', () => {
  it('skips health and ready probes', async () => {
    const { shouldSkipSessionStack } = await import('../../../src/auth/session.js')

    expect(shouldSkipSessionStack({ method: 'GET', path: '/v1/health', headers: {} })).toBe(true)
    expect(shouldSkipSessionStack({ method: 'GET', path: '/v1/ready', headers: {} })).toBe(true)
  })

  it('skips Bearer ingest and keeps cookie ingest on the session stack', async () => {
    const { shouldSkipSessionStack } = await import('../../../src/auth/session.js')

    expect(
      shouldSkipSessionStack({
        method: 'POST',
        path: '/v1/events',
        headers: { authorization: 'Bearer whk_test' },
      }),
    ).toBe(true)

    expect(shouldSkipSessionStack({ method: 'POST', path: '/v1/events', headers: {} })).toBe(false)
    expect(
      shouldSkipSessionStack({
        method: 'GET',
        path: '/v1/events',
        headers: { authorization: 'Bearer whk_test' },
      }),
    ).toBe(false)
  })
})
