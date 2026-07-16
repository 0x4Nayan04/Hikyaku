import { DocsApiRoute } from '@/components/docs/DocsApiRoute'
import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsCodeBlock } from '@/components/docs/DocsCodeBlock'
import { DocsHeading } from '@/components/docs/DocsHeading'
import { OUTBOUND_BODY } from '@/docs/constants'

const TOC = [
  { id: 'body', label: 'Delivery body', level: 2 as const },
  { id: 'headers', label: 'Headers', level: 2 as const },
  { id: 'statuses', label: 'Delivery statuses', level: 2 as const },
  { id: 'inspection', label: 'Inspection & live updates', level: 2 as const },
]

export function OutboundPage() {
  return (
    <DocsArticle
      slug="outbound"
      title="Outbound deliveries"
      description="What subscribers receive and how to track it"
      toc={TOC}
    >
      <p className="docs-v2-prose">
        Each active endpoint gets a signed POST for every ingested event. Here is the body shape, the headers to trust,
        and how to follow delivery status.
      </p>

      <DocsHeading id="body" level={2}>
        Delivery body
      </DocsHeading>
      <p className="docs-v2-prose">
        Subscribers receive JSON. Your ingest <code>payload</code> is nested under <code>data</code>:
      </p>
      <DocsCodeBlock label="Delivery body" code={OUTBOUND_BODY} language="json" />

      <DocsHeading id="headers" level={2}>
        Headers
      </DocsHeading>
      <DocsCodeBlock
        label="Delivery headers"
        code={`Content-Type: application/json
X-Webhook-Id: <delivery_uuid>
X-Webhook-Timestamp: <unix_seconds>
X-Webhook-Signature: sha256=<hmac_hex>
User-Agent: WebhookDelivery/1.0`}
        language="http"
      />
      <p className="docs-v2-prose">
        <code>X-Webhook-Id</code> is the delivery UUID. It stays the same across retries for that event×endpoint pair —
        use it to dedupe under at-least-once delivery.
      </p>

      <DocsHeading id="statuses" level={2}>
        Delivery statuses
      </DocsHeading>
      <ul className="docs-v2-list">
        <li>
          <code>pending</code> — queued, not yet in flight
        </li>
        <li>
          <code>in_progress</code> — HTTP attempt running
        </li>
        <li>
          <code>succeeded</code> — subscriber returned 2xx
        </li>
        <li>
          <code>failed</code> — retries exhausted or fail-fast 4xx
        </li>
        <li>
          <code>deferred</code> — rate-limited; will retry without burning an attempt
        </li>
      </ul>

      <DocsHeading id="inspection" level={2}>
        Inspection & live updates
      </DocsHeading>
      <p className="docs-v2-prose">
        List deliveries with <DocsApiRoute method="GET" path="/v1/deliveries" /> (optional{' '}
        <code>?status=failed</code>), or open one with <DocsApiRoute method="GET" path="/v1/deliveries/:id" /> for the
        attempt timeline. Attempts may include a truncated response body (~1KB) for debugging. In the console, open a
        delivery to inspect attempts and replay failures.
      </p>
      <p className="docs-v2-prose">
        Live updates use <DocsApiRoute method="GET" path="/v1/deliveries/stream" /> (SSE, session cookie only), with
        polling as a fallback when the stream is unavailable.
      </p>
    </DocsArticle>
  )
}
