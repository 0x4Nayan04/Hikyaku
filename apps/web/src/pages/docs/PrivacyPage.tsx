import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsCallout } from '@/components/docs/DocsCallout'

export function PrivacyPage() {
  return (
    <DocsArticle
      slug="privacy"
      title="Privacy & data"
      description="What we store, hash, and show once"
    >
      <p className="docs-v2-prose">
        API keys are stored as SHA-256 hashes; the full secret is shown only on create or rotate. Endpoint signing
        secrets are kept server-side so the worker can sign outbound POSTs, and are shown once at creation. Session
        cookies power the console. Delivery attempt logs may include a truncated response body (~1KB) for debugging.
      </p>
      <DocsCallout variant="danger" label="Protect secrets">
        <p>
          Do not commit API keys or signing secrets to source control or paste them into tickets. Revoke a compromised
          key from Settings immediately. To rotate an endpoint signing secret, create a new endpoint, point subscribers
          at it, then disable the old one — secrets cannot be rotated in place.
        </p>
      </DocsCallout>
    </DocsArticle>
  )
}
