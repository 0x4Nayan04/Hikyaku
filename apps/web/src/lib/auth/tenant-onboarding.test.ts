import { describe, expect, it } from 'vitest'
import { buildIngestCurl, buildOnboardingSteps } from './tenant-onboarding'

describe('buildOnboardingSteps', () => {
  it('marks every step from real state', () => {
    const steps = buildOnboardingSteps({
      hasActiveEndpoint: true,
      hasAnyEndpoint: true,
      hasTestEvent: true,
      hasDeliveries: true,
    })
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ['endpoint', true],
      ['test_event', true],
      ['deliveries', true],
    ])
  })

  it('guides operators to enable a disabled endpoint', () => {
    const steps = buildOnboardingSteps({
      hasActiveEndpoint: false,
      hasAnyEndpoint: true,
      hasTestEvent: false,
      hasDeliveries: false,
    })
    expect(steps[0]).toMatchObject({
      id: 'endpoint',
      label: 'Enable an endpoint',
      to: '/endpoints?status=disabled',
      done: false,
    })
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
