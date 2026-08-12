import { describe, expect, it } from 'vitest'
import {
  endpointDisplayLabel,
  formatEndpointUrlDistinctive,
  formatEndpointUrlForDisplay,
} from './format'

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

describe('endpointDisplayLabel', () => {
  it('prefers description over hostname', () => {
    expect(
      endpointDisplayLabel({
        description: 'Billing',
        url: 'https://billing.acme.dev/events',
      }),
    ).toBe('Billing')
  })

  it('falls back to hostname', () => {
    expect(
      endpointDisplayLabel({
        description: null,
        url: 'https://billing.acme.dev/events',
      }),
    ).toBe('billing.acme.dev')
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
