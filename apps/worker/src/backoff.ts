import { DELIVERY_JOB_OPTIONS } from '@webhook/shared/constants'

const BASE_DELAY_MS = DELIVERY_JOB_OPTIONS.backoff.delay

/** Matches BullMQ exponential backoff: base × 2^(n−1) for n completed HTTP attempts. */
export function calculateBackoffDelayMs(attemptCountAfterHttp: number): number {
  return BASE_DELAY_MS * 2 ** (attemptCountAfterHttp - 1)
}
