export type OnboardingStepId = 'endpoint' | 'test_event' | 'deliveries'

export type OnboardingStep = {
  id: OnboardingStepId
  label: string
  to: string
  done: boolean
}

/** Ordered first-run checklist for an empty tenant dashboard. */
export function buildOnboardingSteps(opts: {
  hasActiveEndpoint: boolean
  hasAnyEndpoint: boolean
  hasTestEvent: boolean
  hasDeliveries: boolean
}): OnboardingStep[] {
  const endpointLabel =
    opts.hasActiveEndpoint || !opts.hasAnyEndpoint ? 'Create an endpoint' : 'Enable an endpoint'

  return [
    {
      id: 'endpoint',
      label: endpointLabel,
      to: '/endpoints',
      done: opts.hasActiveEndpoint,
    },
    {
      id: 'test_event',
      label: 'Send a test event',
      to: '/events/send',
      done: opts.hasTestEvent,
    },
    {
      id: 'deliveries',
      label: 'Watch deliveries',
      to: '/deliveries',
      done: opts.hasDeliveries,
    },
  ]
}

/** Copy-paste ingest curl with the just-created key (shown once). */
export function buildIngestCurl(apiKey: string, apiBase: string): string {
  const origin = apiBase || window.location.origin
  return `curl -X POST "${origin}/v1/events" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "idempotency_key": "order-123-paid",
    "type": "order.paid",
    "payload": { "order_id": "123", "amount": 4999 }
  }'`
}
