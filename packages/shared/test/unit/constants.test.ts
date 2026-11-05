import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DELIVERY_JOB_OPTIONS,
  DELIVERY_STATUSES,
  ENDPOINT_STATUSES,
  EVENT_STATUSES,
  queueName,
} from '../../src/constants.js'

describe('constants', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('resolves queue identity after test environment changes', () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TEST_RUN_ID', 'first')
    expect(queueName()).toBe('webhook-deliveries-test-first')
    vi.stubEnv('TEST_RUN_ID', 'second')
    expect(queueName()).toBe('webhook-deliveries-test-second')
    vi.stubEnv('NODE_ENV', 'production')
    expect(queueName()).toBe('webhook-deliveries')
  })

  it('defines queue retention and attempt limits', () => {
    expect(DELIVERY_JOB_OPTIONS.attempts).toBe(1)
    expect(DELIVERY_JOB_OPTIONS.removeOnComplete).toEqual({ age: 3600, count: 1000 })
    expect(DELIVERY_JOB_OPTIONS.removeOnFail).toEqual({ age: 3600, count: 1000 })
  })

  it('defines status enums', () => {
    expect(EVENT_STATUSES).toContain('pending')
    expect(DELIVERY_STATUSES).toContain('pending')
    expect(ENDPOINT_STATUSES).toContain('active')
  })
})
