import { describe, expect, it, vi } from 'vitest'
import { apiEnvSchema, workerEnvSchema } from '../../src/env.js'

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://webhook:webhook@localhost:5432/webhooks',
  REDIS_URL: 'redis://localhost:6379',
  LOG_LEVEL: 'info',
} as const

const apiSecrets = {
  ADMIN_BOOTSTRAP_SECRET: 'change-me-in-production',
  SESSION_SECRET: 'change-me-session-secret-min-32-chars',
} as const

describe('apiEnvSchema', () => {
  it('parses required fields with defaults', () => {
    const env = apiEnvSchema.parse({
      ...baseEnv,
      ...apiSecrets,
    })

    expect(env.PORT).toBe(3000)
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173')
    expect(env.SESSION_COOKIE_MAX_AGE).toBe(604_800_000)
    expect(env.WEB_APP_URL).toBe('http://localhost:5173')
    expect(env.INVITE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
    expect(env.INGEST_RATE_LIMIT_PER_MINUTE).toBe(120)
    expect(env.AUTH_RATE_LIMIT_PER_MINUTE).toBe(20)
    expect(env.TRUST_PROXY).toBe(0)
  })

  it('coerces TRUST_PROXY from env', () => {
    const env = apiEnvSchema.parse({
      ...baseEnv,
      ...apiSecrets,
      TRUST_PROXY: '1',
    })

    expect(env.TRUST_PROXY).toBe(1)
  })

  it('rejects negative TRUST_PROXY', () => {
    const result = apiEnvSchema.safeParse({
      ...baseEnv,
      ...apiSecrets,
      TRUST_PROXY: '-1',
    })

    expect(result.success).toBe(false)
  })

  it('coerces SESSION_COOKIE_MAX_AGE from env', () => {
    const env = apiEnvSchema.parse({
      ...baseEnv,
      ...apiSecrets,
      SESSION_COOKIE_MAX_AGE: '86400000',
    })

    expect(env.SESSION_COOKIE_MAX_AGE).toBe(86_400_000)
  })

  it('rejects short admin secret', () => {
    const result = apiEnvSchema.safeParse({
      ...baseEnv,
      ...apiSecrets,
      ADMIN_BOOTSTRAP_SECRET: 'short',
    })

    expect(result.success).toBe(false)
  })

  it('allows default admin secret outside production', () => {
    const result = apiEnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'development',
      ...apiSecrets,
      ADMIN_BOOTSTRAP_SECRET: 'change-me-in-production',
    })

    expect(result.success).toBe(true)
  })

  it('rejects default admin secret in production', () => {
    const result = apiEnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      ...apiSecrets,
      ADMIN_BOOTSTRAP_SECRET: 'change-me-in-production',
      SESSION_SECRET: 'a'.repeat(32),
    })

    expect(result.success).toBe(false)
  })

  it('rejects default session secret in production', () => {
    const result = apiEnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      ADMIN_BOOTSTRAP_SECRET: 'a'.repeat(32),
      SESSION_SECRET: 'change-me-session-secret-min-32-chars',
    })

    expect(result.success).toBe(false)
  })

  it('rejects short admin secret in production even if not default', () => {
    const result = apiEnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      ...apiSecrets,
      ADMIN_BOOTSTRAP_SECRET: 'only-sixteen-chars',
      SESSION_SECRET: 'a'.repeat(32),
    })

    expect(result.success).toBe(false)
  })

  it('accepts a strong admin secret in production', () => {
    const result = apiEnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      ADMIN_BOOTSTRAP_SECRET: 'a'.repeat(32),
      SESSION_SECRET: 'b'.repeat(32),
      TRUST_PROXY: '1',
    })

    expect(result.success).toBe(true)
  })

  it('parseApiEnv requires TRUST_PROXY in production', async () => {
    const { parseApiEnv } = await import('../../src/env.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 0}`)
    }) as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      expect(() =>
        parseApiEnv({
          ...baseEnv,
          NODE_ENV: 'production',
          ADMIN_BOOTSTRAP_SECRET: 'a'.repeat(32),
          SESSION_SECRET: 'b'.repeat(32),
        }),
      ).toThrow(/exit:1/)
      expect(errorSpy.mock.calls.some((c) => String(c[0]).includes('TRUST_PROXY'))).toBe(true)
    } finally {
      exitSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })

  it('parseApiEnv accepts TRUST_PROXY=1 in production', async () => {
    const { parseApiEnv } = await import('../../src/env.js')
    const env = parseApiEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      ADMIN_BOOTSTRAP_SECRET: 'a'.repeat(32),
      SESSION_SECRET: 'b'.repeat(32),
      TRUST_PROXY: '1',
    })
    expect(env.TRUST_PROXY).toBe(1)
  })

  it('rejects short session secret', () => {
    const result = apiEnvSchema.safeParse({
      ...baseEnv,
      ...apiSecrets,
      SESSION_SECRET: 'too-short',
    })

    expect(result.success).toBe(false)
  })
})

describe('workerEnvSchema', () => {
  it('applies worker defaults', () => {
    const env = workerEnvSchema.parse(baseEnv)

    expect(env.DELIVERY_TIMEOUT_MS).toBe(30_000)
    expect(env.MAX_DELIVERY_ATTEMPTS).toBe(5)
    expect(env.RATE_LIMIT_PER_MINUTE).toBe(100)
    expect(env.WORKER_CONCURRENCY).toBe(5)
  })

  it('coerces custom RATE_LIMIT_PER_MINUTE from env', () => {
    const env = workerEnvSchema.parse({
      ...baseEnv,
      RATE_LIMIT_PER_MINUTE: '250',
    })

    expect(env.RATE_LIMIT_PER_MINUTE).toBe(250)
  })
})
