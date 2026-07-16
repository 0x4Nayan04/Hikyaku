import { DocsApiRoute } from '@/components/docs/DocsApiRoute'
import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsCallout } from '@/components/docs/DocsCallout'
import { DocsCodeBlock } from '@/components/docs/DocsCodeBlock'
import { DocsHeading } from '@/components/docs/DocsHeading'
import { CREATE_ENDPOINT_CURL } from '@/docs/constants'

const TOC = [
  { id: 'create', label: 'Create endpoint', level: 2 as const },
  { id: 'console', label: 'Console workflow', level: 2 as const },
]

export function EndpointsPage() {
  return (
    <DocsArticle
      slug="endpoints"
      title="Endpoints"
      description="Register subscriber URLs and signing secrets"
      toc={TOC}
    >
      <p className="docs-v2-prose">
        An endpoint is a subscriber URL that receives signed webhook POSTs. Create one with{' '}
        <DocsApiRoute method="POST" path="/v1/endpoints" /> — the signing secret is returned once. Active endpoints
        receive fan-out; disabled endpoints do not.
      </p>

      <DocsHeading id="create" level={2}>
        Create endpoint
      </DocsHeading>
      <DocsCodeBlock label="Create endpoint" code={CREATE_ENDPOINT_CURL} language="bash" />
      <p className="docs-v2-prose">
        URL and secret cannot change after create. You can update status or description with{' '}
        <DocsApiRoute method="PATCH" path="/v1/endpoints/:id" />. To change a URL or rotate a signing secret, create a
        new endpoint and disable the old one.
      </p>

      <DocsHeading id="console" level={2}>
        Console workflow
      </DocsHeading>
      <p className="docs-v2-prose">
        In the console, open <strong>Endpoints → Create endpoint</strong>, paste your receiver URL, and optionally store
        the secret under <strong>Settings → Endpoint secrets</strong>.
      </p>
      <DocsCallout variant="warning" label="Browser vault">
        <p>
          Secrets saved in Settings stay in this browser only — useful for local checks, not a backup. Copy the secret
          into your secret manager when the endpoint is created.
        </p>
      </DocsCallout>
    </DocsArticle>
  )
}
