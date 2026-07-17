export const QUEUE_NAME = 'webhook-deliveries'
export const JOB_NAME = 'deliver'

export const MAX_INGEST_BODY_BYTES = 256 * 1024

export const MAX_DELIVERY_ATTEMPTS = 5
export const BULLMQ_JOB_ATTEMPTS = 10
export const DELIVERY_TIMEOUT_MS = 30_000
export const WORKER_LOCK_DURATION_MS = DELIVERY_TIMEOUT_MS + 30_000
export const RATE_LIMIT_PER_MINUTE = 100
export const RATE_LIMIT_DEFER_MS = 60_000
export const WORKER_CONCURRENCY = 5

export const DELIVERY_JOB_OPTIONS = {
  attempts: BULLMQ_JOB_ATTEMPTS,
  backoff: { type: 'exponential' as const, delay: 60_000 },
  removeOnComplete: 1000,
  removeOnFail: 1000,
}

export const EVENT_STATUSES = ['pending', 'completed', 'failed'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]

export const DELIVERY_STATUSES = [
  'pending',
  'in_progress',
  'succeeded',
  'failed',
  'deferred',
] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export const ENDPOINT_STATUSES = ['active', 'disabled'] as const
export type EndpointStatus = (typeof ENDPOINT_STATUSES)[number]

export const TENANT_STATUSES = ['active', 'suspended'] as const
export type TenantStatus = (typeof TENANT_STATUSES)[number]

export const SIGNUP_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const
export type SignupRequestStatus = (typeof SIGNUP_REQUEST_STATUSES)[number]
