import { DocsApiRoute } from '@/components/docs/DocsApiRoute'
import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsCallout } from '@/components/docs/DocsCallout'
import { DocsCodeBlock } from '@/components/docs/DocsCodeBlock'
import { DocsHeading } from '@/components/docs/DocsHeading'
import { DocsTable } from '@/components/docs/DocsTable'
import { INGEST_RESPONSE } from '@/docs/constants'

const TOC = [
  { id: 'request', label: 'Request body', level: 2 as const },
  { id: 'statuses', label: 'Event statuses', level: 2 as const },
]

export function IngestPage() {
  return (
    <DocsArticle
      slug="ingest"
      title="Ingest events"
      description="Accept events once, fan them out safely"
      toc={TOC}
    >
      <p className="docs-v2-prose">
        Post an event to <DocsApiRoute method="POST" path="/v1/events" />. The body must include three fields and stay
        under <strong>256 KiB</strong> when serialized.
      </p>

      <DocsHeading id="request" level={2}>
        Request body
      </DocsHeading>
      <DocsTable label="Fields">
        <thead>
          <tr>
            <th>Field</th>
            <th>Rules</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>idempotency_key</code>
            </td>
            <td>1–256 chars; unique per tenant</td>
          </tr>
          <tr>
            <td>
              <code>type</code>
            </td>
            <td>
              1–128 chars (e.g. <code>order.paid</code>)
            </td>
          </tr>
          <tr>
            <td>
              <code>payload</code>
            </td>
            <td>JSON object (string keys)</td>
          </tr>
        </tbody>
      </DocsTable>
      <DocsCodeBlock
        label="Request body"
        code={`{
  "idempotency_key": "order-123-paid",
  "type": "order.paid",
  "payload": { "order_id": "123", "amount": 4999 }
}`}
        language="json"
      />
      <DocsCodeBlock label="Response (202)" code={INGEST_RESPONSE} language="json" />

      <DocsHeading id="statuses" level={2}>
        Event statuses
      </DocsHeading>
      <p className="docs-v2-prose">
        An event’s status rolls up from its deliveries: <code>pending</code> while anything is still open,{' '}
        <code>failed</code> when every delivery failed, and <code>completed</code> once all deliveries are terminal and
        at least one succeeded. List events with <DocsApiRoute method="GET" path="/v1/events" />, or open a single event
        with <DocsApiRoute method="GET" path="/v1/events/:id" />. The console <strong>Events</strong> and{' '}
        <strong>Send event</strong> pages wrap the same APIs.
      </p>
      <DocsCallout variant="info" label="Idempotency">
        <p>
          Reusing the same <code>idempotency_key</code> for a tenant returns the existing event with <code>202</code> —
          no duplicate fan-out.
        </p>
      </DocsCallout>
    </DocsArticle>
  )
}
