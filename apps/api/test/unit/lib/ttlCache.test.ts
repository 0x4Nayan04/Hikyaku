import { describe, expect, it } from 'vitest'
import { createTtlCache } from '../../../src/lib/ttlCache.js'

describe('createTtlCache', () => {
  it('returns a stored value before expiry', () => {
    const cache = createTtlCache<string>(60_000)
    cache.set('k', 'v')
    expect(cache.get('k')).toBe('v')
  })

  it('drops expired entries', () => {
    const cache = createTtlCache<string>(-1)
    cache.set('k', 'v')
    expect(cache.get('k')).toBeUndefined()
  })
})
