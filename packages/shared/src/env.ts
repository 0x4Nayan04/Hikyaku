import { z } from 'zod'

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export const apiEnvSchema = baseSchema.extend({
  PORT: z.coerce.number().default(3000),
  ADMIN_BOOTSTRAP_SECRET: z.string().min(8),
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_MAX_AGE: z.coerce.number().default(604_800_000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
})

export const workerEnvSchema = baseSchema.extend({
  DELIVERY_TIMEOUT_MS: z.coerce.number().default(30_000),
  MAX_DELIVERY_ATTEMPTS: z.coerce.number().default(5),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().default(100),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
})

export type ApiEnv = z.infer<typeof apiEnvSchema>
export type WorkerEnv = z.infer<typeof workerEnvSchema>

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
}

export function parseApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
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
