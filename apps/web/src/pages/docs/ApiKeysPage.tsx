import { DocsApiRoute } from '@/components/docs/DocsApiRoute'
import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsCodeBlock } from '@/components/docs/DocsCodeBlock'
import { CREATE_API_KEY_CURL } from '@/docs/constants'

export function ApiKeysPage() {
  return (
    <DocsArticle
      slug="api-keys"
      title="API keys"
      description="Create and rotate keys for backend ingest"
    >
      <p className="docs-v2-prose">
        Create keys in <strong>Settings → API keys</strong> or via the API. The create response includes the full secret
        once — store it immediately.
      </p>
      <DocsCodeBlock label="Create API key" code={CREATE_API_KEY_CURL} language="bash" />
      <p className="docs-v2-prose">
        List responses show a short <code>prefix</code> for identification, never the full secret. Revoke a compromised
        or unused key with <DocsApiRoute method="POST" path="/v1/api-keys/:id/revoke" />. Prefer{' '}
        <DocsApiRoute method="POST" path="/v1/api-keys/:id/rotate" /> when producers still need a live key — it issues a
        replacement and invalidates the old one in one step.
      </p>
    </DocsArticle>
  )
}
