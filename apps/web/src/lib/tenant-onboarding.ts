export type OnboardingStepId = 'endpoint' | 'api_key' | 'test_event' | 'deliveries'

export type OnboardingStep = {
  id: OnboardingStepId
  label: string
  to: string
  done: boolean
}

/** Ordered first-run checklist for an empty tenant dashboard. */
export function buildOnboardingSteps(opts: {
  hasEndpoint: boolean
  hasApiKey: boolean
  hasTestEvent: boolean
  hasDeliveries: boolean
}): OnboardingStep[] {
  return [
    {
      id: 'endpoint',
      label: 'Create an endpoint',
      to: '/endpoints',
      done: opts.hasEndpoint,
    },
    {
      id: 'api_key',
      label: 'Create an API key',
      to: '/settings?tab=api-keys',
      done: opts.hasApiKey,
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
  return `curl -X POST "${apiBase}/v1/events" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "idempotency_key": "order-123-paid",
    "type": "order.paid",
    "payload": { "order_id": "123", "amount": 4999 }
  }'`
}
