import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsHeading } from '@/components/docs/DocsHeading'
import { APP_NAME } from '@/lib/app-meta'

const TOC = [
  { id: 'pipeline', label: 'How it works', level: 2 as const },
  { id: 'concepts', label: 'Core concepts', level: 2 as const },
]

export function IntroductionPage() {
  return (
    <DocsArticle
      slug="introduction"
      title="Introduction"
      description="Ingest, fan-out, signing, and retries"
      toc={TOC}
    >
      <DocsHeading id="pipeline" level={2}>
        How it works
      </DocsHeading>
      <p className="docs-v2-prose">
        {APP_NAME} is a multi-tenant webhook delivery system. You POST an event to the ingest API;
        the worker fans it out to each active endpoint for your tenant, signs every outbound POST
        with HMAC-SHA256, retries transient failures with exponential backoff, and stores attempt
        history for the console.
      </p>
      <p className="docs-v2-prose">
        Each tenant is an isolated workspace. API keys, endpoints, events, and deliveries do not
        cross tenant boundaries.
      </p>

      <DocsHeading id="concepts" level={2}>
        Core concepts
      </DocsHeading>
      <ul className="docs-v2-list">
        <li>
          <strong>Endpoint</strong> — a subscriber URL that receives signed POSTs, with its own
          signing secret.
        </li>
        <li>
          <strong>Event</strong> — the JSON message you ingest, identified by an idempotency key.
        </li>
        <li>
          <strong>Delivery</strong> — one event sent to one endpoint, including retries and attempt
          history.
        </li>
        <li>
          <strong>API key</strong> — Bearer auth for ingest and management APIs, scoped to one
          tenant.
        </li>
      </ul>
    </DocsArticle>
  )
}
