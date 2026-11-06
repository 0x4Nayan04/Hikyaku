import { describe, expect, it } from 'vitest'
import { parseStatusQuery, updateStatusQuery } from './status-query'

describe('status query', () => {
  it('uses each page default for missing or invalid values and accepts explicit options', () => {
    const options = ['all', 'open', 'active', 'disabled'] as const
    expect(parseStatusQuery(null, options, 'all')).toBe('all')
    expect(parseStatusQuery('invalid', options, 'active')).toBe('active')
    expect(parseStatusQuery('all', options, 'active')).toBe('all')
    expect(parseStatusQuery('open', options, 'all')).toBe('open')
  })

  it('preserves unrelated parameters and removes only the default status', () => {
    const original = new URLSearchParams('event_id=123&tag=a&tag=b&status=disabled')
    expect(updateStatusQuery(original, 'active', 'active').toString()).toBe(
      'event_id=123&tag=a&tag=b',
    )
    expect(updateStatusQuery(original, 'all', 'active').get('status')).toBe('all')
    expect(updateStatusQuery(original, 'open', 'all').get('status')).toBe('open')
    expect(original.get('status')).toBe('disabled')
  })
})
