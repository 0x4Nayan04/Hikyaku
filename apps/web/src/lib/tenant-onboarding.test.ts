import { describe, expect, it } from 'vitest'
import {
  buildIngestCurl,
  buildOnboardingSteps,
  hasActiveEndpoint,
} from './tenant-onboarding'

describe('hasActiveEndpoint', () => {
  it('allows send only when an active endpoint exists', () => {
    expect(hasActiveEndpoint([])).toBe(false)
    expect(hasActiveEndpoint([{ status: 'disabled' }])).toBe(false)
    expect(hasActiveEndpoint([{ status: 'disabled' }, { status: 'active' }])).toBe(true)
  })
})

describe('buildOnboardingSteps', () => {
  it('marks endpoint and API key from real state', () => {
    const steps = buildOnboardingSteps({ hasEndpoint: true, hasApiKey: false })
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ['endpoint', true],
      ['api_key', false],
      ['test_event', false],
      ['deliveries', false],
    ])
  })
})

describe('buildIngestCurl', () => {
  it('embeds the API key and base URL', () => {
    const curl = buildIngestCurl('whk_secret', 'http://localhost:3000')
    expect(curl).toContain('Authorization: Bearer whk_secret')
    expect(curl).toContain('http://localhost:3000/v1/events')
    expect(curl).toContain('order.paid')
  })
})
