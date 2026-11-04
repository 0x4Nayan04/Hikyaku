import { z } from 'zod'
import { CONFIG_DEFAULTS } from './constants/config.js'

const DEFAULT_ADMIN_BOOTSTRAP_SECRETS = new Set(['change-me-in-production'])
const DEFAULT_SESSION_SECRETS = new Set(['change-me-session-secret-min-32-chars'])

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default(CONFIG_DEFAULTS.NODE_ENV),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default(CONFIG_DEFAULTS.LOG_LEVEL),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(CONFIG_DEFAULTS.DB_POOL_MAX),
})

export const apiEnvSchema = baseSchema
  .extend({
    PORT: z.coerce.number().int().min(1).max(65_535).default(CONFIG_DEFAULTS.PORT),
    ADMIN_BOOTSTRAP_SECRET: z.string().min(8),
    SESSION_SECRET: z.string().min(32),
    SESSION_COOKIE_MAX_AGE: z.coerce
      .number()
      .int()
      .positive()
      .default(CONFIG_DEFAULTS.SESSION_COOKIE_MAX_AGE),
    CORS_ORIGIN: z.string().default(CONFIG_DEFAULTS.CORS_ORIGIN),
    WEB_APP_URL: z.string().url().default(CONFIG_DEFAULTS.WEB_APP_URL),
    INVITE_TTL_MS: z.coerce.number().int().positive().default(CONFIG_DEFAULTS.INVITE_TTL_MS),
    INGEST_RATE_LIMIT_PER_MINUTE: z.coerce
      .number()
      .int()
      .positive()
      .default(CONFIG_DEFAULTS.INGEST_RATE_LIMIT_PER_MINUTE),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce
      .number()
      .int()
      .positive()
      .default(CONFIG_DEFAULTS.AUTH_RATE_LIMIT_PER_MINUTE),
    TRUST_PROXY: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.coerce.number().int().min(0).optional(),
    ),

    PROXY_IP_SECRET: z.string().min(16).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') return

    if (data.TRUST_PROXY === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TRUST_PROXY'],
        message:
          'Must be set explicitly in production (1 behind a reverse proxy; 0 only if the API terminates TLS itself)',
      })
    }

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
  .transform((data) => ({ ...data, TRUST_PROXY: data.TRUST_PROXY ?? CONFIG_DEFAULTS.TRUST_PROXY }))

export const workerEnvSchema = baseSchema.extend({
  DELIVERY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(CONFIG_DEFAULTS.DELIVERY_TIMEOUT_MS),
  MAX_DELIVERY_ATTEMPTS: z.coerce
    .number()
    .int()
    .positive()
    .default(CONFIG_DEFAULTS.MAX_DELIVERY_ATTEMPTS),
  RATE_LIMIT_PER_MINUTE: z.coerce
    .number()
    .int()
    .positive()
    .default(CONFIG_DEFAULTS.RATE_LIMIT_PER_MINUTE),
  WORKER_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .default(CONFIG_DEFAULTS.WORKER_CONCURRENCY),
  SWEEP_INTERVAL_MS: z.coerce.number().int().min(1_000).default(CONFIG_DEFAULTS.SWEEP_INTERVAL_MS),
})

export type ApiEnv = z.infer<typeof apiEnvSchema>
export type WorkerEnv = z.infer<typeof workerEnvSchema>
export type LogLevel = ApiEnv['LOG_LEVEL']

export class EnvValidationError extends Error {
  constructor(application: string, issues: z.ZodError) {
    const details = issues.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    super(`Invalid ${application} environment:\n${details}`, { cause: issues })
    this.name = 'EnvValidationError'
  }
}

function parseEnvironment<Schema extends z.ZodTypeAny>(
  schema: Schema,
  source: NodeJS.ProcessEnv,
  application: string,
): z.output<Schema> {
  const result = schema.safeParse(source)
  if (!result.success) throw new EnvValidationError(application, result.error)
  return result.data
}

export function parseApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return parseEnvironment(apiEnvSchema, source, 'API')
}

export function parseWorkerEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  return parseEnvironment(workerEnvSchema, source, 'worker')
}
