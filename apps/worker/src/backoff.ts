const RETRY_BASE_DELAY_MS = 60_000

/** Application-owned exponential backoff: base × 2^(n−1) for completed HTTP attempts. */
export function calculateBackoffDelayMs(attemptCountAfterHttp: number): number {
  return RETRY_BASE_DELAY_MS * 2 ** (attemptCountAfterHttp - 1)
}
