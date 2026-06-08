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
  it('uses SameSite=Lax and Secure in production', async () => {
    const { createSessionMiddleware } = await import('../../../src/auth/session.js')
    const options = createSessionMiddleware() as unknown as {
      cookie: { sameSite: string; secure: boolean; httpOnly: boolean }
    }

    expect(options.cookie).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    })
  })
})
