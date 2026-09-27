// Browser bundles import this module, and `process` does not exist there under the Vite dev server.
export const QUEUE_NAME =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'test' && process.env.TEST_RUN_ID
  ? `webhook-deliveries-test-${process.env.TEST_RUN_ID}`
  : 'webhook-deliveries'
export const JOB_NAME = 'deliver'

export type DeliveryJobData = {
  deliveryId: string
  tenantId: string
}

export const MAX_INGEST_BODY_BYTES = 256 * 1024
export const MIN_PASSWORD_LENGTH = 12

export const CONFIG_DEFAULTS = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  PORT: 3000,
  SESSION_COOKIE_MAX_AGE: 604_800_000,
  CORS_ORIGIN: 'http://localhost:5173',
  WEB_APP_URL: 'http://localhost:5173',
  INVITE_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  INGEST_RATE_LIMIT_PER_MINUTE: 120,
  AUTH_RATE_LIMIT_PER_MINUTE: 20,
  TRUST_PROXY: 0,
  DELIVERY_TIMEOUT_MS: 30_000,
  MAX_DELIVERY_ATTEMPTS: 5,
  RATE_LIMIT_PER_MINUTE: 100,
  WORKER_CONCURRENCY: 5,
  SWEEP_INTERVAL_MS: 5 * 60 * 1000,
  DB_POOL_MAX: 10,
} as const

export const RATE_LIMIT_DEFER_MS = 60_000
export const RATE_LIMIT_JITTER_MS = 5_000

export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300

export const DELIVERY_JOB_OPTIONS = {
  attempts: 1,
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 3600, count: 1000 },
}

export const EVENT_STATUSES = ['pending', 'completed', 'partial_failure', 'failed', 'no_recipients'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]

export const DELIVERY_STATUSES = ['pending', 'in_progress', 'succeeded', 'failed'] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export const ENDPOINT_STATUSES = ['active', 'disabled'] as const
export type EndpointStatus = (typeof ENDPOINT_STATUSES)[number]
