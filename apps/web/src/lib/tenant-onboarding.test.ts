import { describe, expect, it } from 'vitest'
import { buildIngestCurl, buildOnboardingSteps } from './tenant-onboarding'

describe('buildOnboardingSteps', () => {
  it('marks every step from real state', () => {
    const steps = buildOnboardingSteps({
      hasEndpoint: true,
      hasApiKey: false,
      hasTestEvent: true,
      hasDeliveries: true,
    })
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ['endpoint', true],
      ['api_key', false],
      ['test_event', true],
      ['deliveries', true],
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
