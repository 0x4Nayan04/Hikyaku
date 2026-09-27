import { describe, expect, it } from 'vitest'
import {
  formatDeliveryAttempts,
  formatEndpointUrlDistinctive,
  formatEndpointUrlForDisplay,
} from './format'

describe('formatDeliveryAttempts', () => {
  it('pluralizes the current run', () => {
    expect(formatDeliveryAttempts({ attemptCount: 1, replayCount: 0 })).toBe('1 attempt')
    expect(formatDeliveryAttempts({ attemptCount: 2, replayCount: 0 })).toBe('2 attempts')
  })

  it('marks replays on the list and dashboard', () => {
    expect(formatDeliveryAttempts({ attemptCount: 1, replayCount: 1 })).toBe(
      '1 attempt · replayed 1x',
    )
  })

  it('adds the all-runs total on the detail page', () => {
    expect(
      formatDeliveryAttempts({ attemptCount: 1, replayCount: 1, totalAttempts: 2 }),
    ).toBe('1 attempt this run · 2 total')
  })
})

describe('formatEndpointUrlDistinctive', () => {
  it('keeps short URLs intact', () => {
    expect(formatEndpointUrlDistinctive('https://hooks.example/a')).toBe(
      'https://hooks.example/a',
    )
  })

  it('prefers host plus last path segment for long same-host URLs', () => {
    const url =
      'https://webhook.site/hooks/v1/inbound/11502179-92cd-450c-9853-6463be2338b0'
    expect(formatEndpointUrlDistinctive(url, 56)).toBe(
      'webhook.site/…/11502179-92cd-450c-9853-6463be2338b0',
    )
  })

  it('falls back to path tail when the budget is tight', () => {
    const url =
      'https://webhook.site/hooks/v1/inbound/11502179-92cd-450c-9853-6463be2338b0'
    expect(formatEndpointUrlDistinctive(url, 40)).toBe(
      '…/11502179-92cd-450c-9853-6463be2338b0',
    )
  })
})

describe('formatEndpointUrlForDisplay', () => {
  it('truncates long paths after the origin', () => {
    const url = `https://hooks.example.com/${'a'.repeat(80)}`
    const formatted = formatEndpointUrlForDisplay(url, 40)
    expect(formatted.startsWith('https://hooks.example.com/')).toBe(true)
    expect(formatted.endsWith('…')).toBe(true)
    expect(formatted.length).toBeLessThanOrEqual(40)
  })
})
