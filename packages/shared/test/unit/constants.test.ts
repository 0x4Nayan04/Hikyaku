import { describe, expect, it } from 'vitest'
import {
  DELIVERY_STATUSES,
  ENDPOINT_STATUSES,
  EVENT_STATUSES,
  QUEUE_NAME,
  SIGNUP_REQUEST_STATUSES,
} from '../../src/constants.js'

describe('constants', () => {
  it('defines queue name', () => {
    expect(QUEUE_NAME).toBe('webhook-deliveries')
  })

  it('defines status enums', () => {
    expect(EVENT_STATUSES).toContain('pending')
    expect(DELIVERY_STATUSES).toContain('deferred')
    expect(ENDPOINT_STATUSES).toContain('active')
    expect(SIGNUP_REQUEST_STATUSES).toEqual(['pending', 'approved', 'rejected'])
  })
})
