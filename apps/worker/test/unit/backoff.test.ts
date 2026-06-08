import { describe, expect, it } from 'vitest'
import { calculateBackoffDelayMs } from '../../src/backoff.js'

describe('calculateBackoffDelayMs', () => {
  it.each([
    [1, 60_000],
    [2, 120_000],
    [3, 240_000],
    [4, 480_000],
  ])('after %i HTTP attempt(s) delays %i ms', (attemptCountAfterHttp, expectedMs) => {
    expect(calculateBackoffDelayMs(attemptCountAfterHttp)).toBe(expectedMs)
  })
})
