import { describe, expect, it } from 'vitest'
import { apiEnvSchema, workerEnvSchema } from '../../src/env.js'

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://webhook:webhook@localhost:5432/webhooks',
  REDIS_URL: 'redis://localhost:6379',
  LOG_LEVEL: 'info',
} as const

describe('apiEnvSchema', () => {
  it('parses required fields with defaults', () => {
    const env = apiEnvSchema.parse({
      ...baseEnv,
      ADMIN_BOOTSTRAP_SECRET: 'change-me-in-production',
    })

    expect(env.PORT).toBe(3000)
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173')
  })

  it('rejects short admin secret', () => {
    const result = apiEnvSchema.safeParse({
      ...baseEnv,
      ADMIN_BOOTSTRAP_SECRET: 'short',
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
