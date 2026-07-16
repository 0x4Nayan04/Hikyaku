import { DocsApiRoute } from '@/components/docs/DocsApiRoute'
import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsCallout } from '@/components/docs/DocsCallout'
import { DocsHeading } from '@/components/docs/DocsHeading'
import { DocsTable } from '@/components/docs/DocsTable'

const TOC = [
  { id: 'policy', label: 'Retry policy', level: 2 as const },
  { id: 'rate-limits', label: 'Rate limiting', level: 2 as const },
  { id: 'replay', label: 'Replay', level: 2 as const },
]

export function RetriesPage() {
  return (
    <DocsArticle
      slug="retries"
      title="Retries & rate limits"
      description="How failed deliveries recover — and when they stop"
      toc={TOC}
    >
      <p className="docs-v2-prose">
        Transient failures are retried automatically. Permanent client errors fail fast. When a delivery is exhausted,
        you can replay it from the API or the console.
      </p>

      <DocsHeading id="policy" level={2}>
        Retry policy
      </DocsHeading>
      <p className="docs-v2-prose">Each delivery gets up to five HTTP attempts with exponential backoff and jitter:</p>
      <DocsTable label="Policy">
        <thead>
          <tr>
            <th>Setting</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Max HTTP attempts</td>
            <td>5 per delivery</td>
          </tr>
          <tr>
            <td>Backoff</td>
            <td>Exponential + jitter (~1m → 2m → 4m → 8m, cap 1h)</td>
          </tr>
          <tr>
            <td>Success</td>
            <td>HTTP 2xx within 30s</td>
          </tr>
          <tr>
            <td>Retryable</td>
            <td>Network error, timeout, 408, 429, 5xx</td>
          </tr>
          <tr>
            <td>Fail-fast</td>
            <td>4xx (except 408, 429)</td>
          </tr>
          <tr>
            <td>Rate limit</td>
            <td>100 HTTP delivery attempts / minute / tenant</td>
          </tr>
        </tbody>
      </DocsTable>

      <DocsHeading id="rate-limits" level={2}>
        Rate limiting
      </DocsHeading>
      <DocsCallout variant="info" label="Deferred deliveries">
        <p>
          When a tenant hits the rate limit, the delivery pauses as <code>deferred</code> for about 60 seconds. That
          pause is not a failure and does not count toward the five-attempt cap. Check deferred and failed rows under{' '}
          <strong>Deliveries</strong>.
        </p>
      </DocsCallout>

      <DocsHeading id="replay" level={2}>
        Replay
      </DocsHeading>
      <p className="docs-v2-prose">
        Only <code>failed</code> deliveries can be re-queued. Call{' '}
        <DocsApiRoute method="POST" path="/v1/deliveries/:id/replay" /> (returns <code>202</code>), or use{' '}
        <strong>Replay</strong> on the delivery detail page in the console. Pending, in-progress, succeeded, and deferred
        deliveries are not replayable.
      </p>
    </DocsArticle>
  )
}
