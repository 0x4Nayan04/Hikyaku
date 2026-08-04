import { z } from 'zod'
import { CONFIG_DEFAULTS } from './constants.js'

const DEFAULT_ADMIN_BOOTSTRAP_SECRETS = new Set(['change-me-in-production'])
const DEFAULT_SESSION_SECRETS = new Set(['change-me-session-secret-min-32-chars'])

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default(CONFIG_DEFAULTS.NODE_ENV),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default(CONFIG_DEFAULTS.LOG_LEVEL),
})

export const apiEnvSchema = baseSchema
  .extend({
    PORT: z.coerce.number().default(CONFIG_DEFAULTS.PORT),
    ADMIN_BOOTSTRAP_SECRET: z.string().min(8),
    SESSION_SECRET: z.string().min(32),
    SESSION_COOKIE_MAX_AGE: z.coerce.number().default(CONFIG_DEFAULTS.SESSION_COOKIE_MAX_AGE),
    CORS_ORIGIN: z.string().default(CONFIG_DEFAULTS.CORS_ORIGIN),
    WEB_APP_URL: z.string().url().default(CONFIG_DEFAULTS.WEB_APP_URL),
    INVITE_TTL_MS: z.coerce.number().default(CONFIG_DEFAULTS.INVITE_TTL_MS),
    INGEST_RATE_LIMIT_PER_MINUTE: z.coerce
      .number()
      .default(CONFIG_DEFAULTS.INGEST_RATE_LIMIT_PER_MINUTE),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce
      .number()
      .default(CONFIG_DEFAULTS.AUTH_RATE_LIMIT_PER_MINUTE),
    TRUST_PROXY: z.coerce.number().int().min(0).default(CONFIG_DEFAULTS.TRUST_PROXY),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') return

    if (data.ADMIN_BOOTSTRAP_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_BOOTSTRAP_SECRET'],
        message: 'Must be at least 32 characters in production',
      })
    }

    if (DEFAULT_ADMIN_BOOTSTRAP_SECRETS.has(data.ADMIN_BOOTSTRAP_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_BOOTSTRAP_SECRET'],
        message: 'Default bootstrap secret is not allowed in production',
      })
    }

    if (DEFAULT_SESSION_SECRETS.has(data.SESSION_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SESSION_SECRET'],
        message: 'Default session secret is not allowed in production',
      })
    }
  })

export const workerEnvSchema = baseSchema.extend({
  DELIVERY_TIMEOUT_MS: z.coerce.number().default(CONFIG_DEFAULTS.DELIVERY_TIMEOUT_MS),
  MAX_DELIVERY_ATTEMPTS: z.coerce.number().default(CONFIG_DEFAULTS.MAX_DELIVERY_ATTEMPTS),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().default(CONFIG_DEFAULTS.RATE_LIMIT_PER_MINUTE),
  WORKER_CONCURRENCY: z.coerce.number().default(CONFIG_DEFAULTS.WORKER_CONCURRENCY),
})

export type ApiEnv = z.infer<typeof apiEnvSchema>
export type WorkerEnv = z.infer<typeof workerEnvSchema>

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
}

export function parseApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  // Production always uses Secure cookies. Behind Railway/nginx those only stick when
  // Express trusts X-Forwarded-Proto — so TRUST_PROXY must be set on purpose (usually 1).
  if (source.NODE_ENV === 'production') {
    const raw = source.TRUST_PROXY
    if (raw === undefined || raw.trim() === '') {
      console.error(
        'Invalid API environment:\nTRUST_PROXY: Must be set explicitly in production (1 behind a reverse proxy such as Railway/nginx; 0 only if the API terminates TLS itself)',
      )
      process.exit(1)
      throw new Error('Invalid API environment')
    }
  }

  const result = apiEnvSchema.safeParse(source)
  if (!result.success) {
    console.error('Invalid API environment:\n' + formatZodError(result.error))
    process.exit(1)
    throw new Error('Invalid API environment')
  }
  return result.data
}

export function parseWorkerEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const result = workerEnvSchema.safeParse(source)
  if (!result.success) {
    console.error('Invalid worker environment:\n' + formatZodError(result.error))
    process.exit(1)
    throw new Error('Invalid worker environment')
  }
  return result.data
}
