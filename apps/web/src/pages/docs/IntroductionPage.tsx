import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsHeading } from '@/components/docs/DocsHeading'

const TOC = [
  { id: 'pipeline', label: 'How it works', level: 2 as const },
  { id: 'concepts', label: 'Core concepts', level: 2 as const },
]

export function IntroductionPage() {
  return (
    <DocsArticle
      slug="introduction"
      title="Introduction"
      description="How events move from ingest to signed delivery"
      toc={TOC}
    >
      <DocsHeading id="pipeline" level={2}>
        How it works
      </DocsHeading>
      <p className="docs-v2-prose">
        Webhook Delivery is a multi-tenant webhook platform. You send an event in; the platform fans it out to every
        active endpoint for your tenant, signs each outbound POST, retries transient failures, and records every attempt
        in the console.
      </p>
      <p className="docs-v2-prose">
        Each tenant is an isolated workspace. API keys, endpoints, events, and deliveries never cross tenant boundaries.
      </p>

      <DocsHeading id="concepts" level={2}>
        Core concepts
      </DocsHeading>
      <ul className="docs-v2-list">
        <li>
          <strong>Endpoint</strong> — a subscriber URL that receives signed POSTs, with its own signing secret.
        </li>
        <li>
          <strong>Event</strong> — the JSON message you ingest, identified by an idempotency key.
        </li>
        <li>
          <strong>Delivery</strong> — one event sent to one endpoint, including retries and attempt history.
        </li>
        <li>
          <strong>API key</strong> — programmatic auth for ingest and management, scoped to a single tenant.
        </li>
      </ul>
    </DocsArticle>
  )
}
