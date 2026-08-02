import { describe, expect, it } from 'vitest'
import {
  DELIVERY_JOB_OPTIONS,
  DELIVERY_STATUSES,
  ENDPOINT_STATUSES,
  EVENT_STATUSES,
  QUEUE_NAME,
} from '../../src/constants.js'

describe('constants', () => {
  it('defines queue name', () => {
    expect(QUEUE_NAME).toBe('webhook-deliveries')
    expect(DELIVERY_JOB_OPTIONS.attempts).toBe(1)
  })

  it('defines status enums', () => {
    expect(EVENT_STATUSES).toContain('pending')
    expect(DELIVERY_STATUSES).toContain('pending')
    expect(ENDPOINT_STATUSES).toContain('active')
  })
})
