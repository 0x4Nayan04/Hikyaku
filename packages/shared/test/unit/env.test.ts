import { describe, expect, it } from 'vitest'
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
