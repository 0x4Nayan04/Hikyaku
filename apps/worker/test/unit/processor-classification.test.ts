import { describe, expect, it, vi } from 'vitest'
import * as httpClient from '../../src/httpClient.js'

vi.mock('../../src/config.js', () => ({ env: { LOG_LEVEL: 'silent' } }))

import { classifyDeliveryError, isRetryableHttpStatus } from '../../src/processor.js'

describe('classifyDeliveryError', () => {
  it('classifies AbortError as timeout', () => {
    const err = new DOMException('The operation was aborted', 'AbortError')
    expect(classifyDeliveryError(err)).toBe('timeout')
  })

  it('classifies blocked redirect and too many redirects as terminal errors', () => {
    expect(
      classifyDeliveryError(
        new httpClient.WebhookTransportError('blocked_url', 'arbitrary wording'),
      ),
    ).toBe('blocked_url')
    expect(classifyDeliveryError(new httpClient.WebhookTransportError('too_many_redirects'))).toBe(
      'too_many_redirects',
    )
  })

  it('classifies other errors as network_error', () => {
    expect(classifyDeliveryError(new TypeError('fetch failed'))).toBe('network_error')
    expect(classifyDeliveryError(new Error('ECONNREFUSED'))).toBe('network_error')
    expect(classifyDeliveryError(new Error('blocked_url: misleading native message'))).toBe(
      'network_error',
    )
  })
})

describe('isRetryableHttpStatus', () => {
  it.each([
    [408, true],
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [404, false],
    [422, false],
  ])('classifies HTTP %i as retryable=%s', (status, expected) => {
    expect(isRetryableHttpStatus(status)).toBe(expected)
  })
})
