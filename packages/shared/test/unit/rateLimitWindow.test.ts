import { RATE_LIMIT_DEFER_MS } from '../../src/constants.js'
import { fixedWindowRedisKeys } from '../../src/rateLimitWindow.js'
import { describe, expect, it } from 'vitest'

describe('fixedWindowRedisKeys', () => {
  it('appends the UTC window and remaining ttl', () => {
    const now = RATE_LIMIT_DEFER_MS + 12_345
    expect(fixedWindowRedisKeys(['ingest:ratelimit:t1'], now)).toEqual({
      redisKeys: ['ingest:ratelimit:t1:1'],
      ttlMs: RATE_LIMIT_DEFER_MS - 12_345,
    })
  })
})
