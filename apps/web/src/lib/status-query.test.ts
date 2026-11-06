import { describe, expect, it } from 'vitest'
import { parseStatusQueryParam, writeStatusQueryParam } from '@/lib/status-query'

const EVENT_OPTIONS = ['all', 'pending', 'completed'] as const
const ENDPOINT_OPTIONS = ['all', 'active', 'disabled'] as const

describe('parseStatusQueryParam', () => {
  it('accepts listed values and falls back otherwise', () => {
    expect(parseStatusQueryParam('pending', EVENT_OPTIONS, 'all')).toBe('pending')
    expect(parseStatusQueryParam(null, EVENT_OPTIONS, 'all')).toBe('all')
    expect(parseStatusQueryParam('nope', EVENT_OPTIONS, 'all')).toBe('all')
    expect(parseStatusQueryParam(null, ENDPOINT_OPTIONS, 'active')).toBe('active')
    expect(parseStatusQueryParam('disabled', ENDPOINT_OPTIONS, 'active')).toBe('disabled')
  })
})

describe('writeStatusQueryParam', () => {
  it('omits the default filter and sets other values', () => {
    const params = new URLSearchParams('status=pending&event_id=1')
    writeStatusQueryParam(params, 'all', 'all')
    expect(params.get('status')).toBeNull()
    expect(params.get('event_id')).toBe('1')

    writeStatusQueryParam(params, 'failed', 'all')
    expect(params.get('status')).toBe('failed')

    writeStatusQueryParam(params, 'active', 'active')
    expect(params.get('status')).toBeNull()
  })
})
