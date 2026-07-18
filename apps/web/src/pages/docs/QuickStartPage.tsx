import { Link } from 'react-router-dom'

import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsCallout } from '@/components/docs/DocsCallout'
import { DocsCodeBlock } from '@/components/docs/DocsCodeBlock'
import { DocsHeading } from '@/components/docs/DocsHeading'
import { INGEST_CURL } from '@/docs/constants'

const TOC = [
  { id: 'console-path', label: 'Console path', level: 2 as const },
  { id: 'api-path', label: 'API-only path', level: 2 as const },
]

export function QuickStartPage() {
  return (
    <DocsArticle
      slug="quick-start"
      title="Quick start"
      description="Bootstrap, create an endpoint, send a test event"
      toc={TOC}
    >
      <p className="docs-v2-prose">
        Pick a path below. Both need the API and worker running — <code>pnpm dev</code> starts them
        together.
      </p>

      <DocsHeading id="console-path" level={2}>
        Console path
      </DocsHeading>
      <ol className="docs-v2-ordered-list">
        <li>
          Bootstrap the first super-admin at <Link to="/bootstrap">/bootstrap</Link> (first deploy
          only).
        </li>
        <li>
          From <strong>Admin</strong>, invite a tenant owner (preferred). Approving a signup request
          works too. Then sign in as that tenant — super-admins stay on platform ops and have no API
          keys tab.
        </li>
        <li>
          Open <strong>Endpoints</strong> and register a receiver URL.
        </li>
        <li>
          Create an API key under <strong>Settings → API keys</strong> (required for backend
          ingest).
        </li>
        <li>
          Prefer <code>POST /v1/events</code> with the key (curl below). <strong>Test event</strong>{' '}
          in the console is a smoke-test shortcut.
        </li>
        <li>
          Confirm the result under <strong>Deliveries</strong>.
        </li>
      </ol>

      <DocsCallout variant="tip" label="Test receivers">
        <p>
          Use{' '}
          <a href="https://webhook.site" target="_blank" rel="noreferrer">
            webhook.site
          </a>{' '}
          or an ngrok tunnel to inspect outbound POSTs while you wire up a real handler.
        </p>
      </DocsCallout>

      <DocsHeading id="api-path" level={2}>
        API-only path
      </DocsHeading>
      <p className="docs-v2-prose">
        Run <code>pnpm db:seed</code>, copy a printed API key, then ingest:
      </p>
      <DocsCodeBlock label="Ingest event" code={INGEST_CURL} language="bash" />
      <p className="docs-v2-prose">
        A successful ingest returns <code>202 Accepted</code> with the event id and enqueues one delivery per active
        endpoint. If deliveries stay pending, check that the worker process is running.
      </p>
    </DocsArticle>
  )
}
