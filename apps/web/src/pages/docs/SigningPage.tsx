import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsCallout } from '@/components/docs/DocsCallout'
import { DocsCodeBlock } from '@/components/docs/DocsCodeBlock'
import { DocsHeading } from '@/components/docs/DocsHeading'
import { VERIFY_NODE, VERIFY_PYTHON } from '@/docs/constants'

const TOC = [
  { id: 'algorithm', label: 'Signing algorithm', level: 2 as const },
  { id: 'node', label: 'Node.js', level: 2 as const },
  { id: 'python', label: 'Python', level: 2 as const },
]

export function SigningPage() {
  return (
    <DocsArticle
      slug="signing"
      title="HMAC signing"
      description="Verify X-Webhook-Signature on the receiver"
      toc={TOC}
    >
      <p className="docs-v2-prose">
        Every outbound POST is signed with HMAC-SHA256. Receivers should verify{' '}
        <code>X-Webhook-Signature</code> before trusting the body.
      </p>

      <DocsHeading id="algorithm" level={2}>
        Signing algorithm
      </DocsHeading>
      <p className="docs-v2-prose">
        Send <code>X-Webhook-Timestamp</code> (unix seconds) and sign the UTF-8 string{' '}
        <code>timestamp.raw_body</code> (a literal dot between that timestamp and the raw request
        body) with the endpoint secret. Put the result in <code>X-Webhook-Signature</code> as{' '}
        <code>sha256=&lt;hex&gt;</code>.
      </p>
      <DocsCallout variant="tip" label="Verify before parsing">
        <p>
          Always verify against the raw body bytes before <code>JSON.parse</code>. Re-serializing
          JSON can change whitespace and break the signature.
        </p>
      </DocsCallout>

      <DocsHeading id="node" level={2}>
        Node.js
      </DocsHeading>
      <DocsCodeBlock label="Node.js verification" code={VERIFY_NODE} language="javascript" />

      <DocsHeading id="python" level={2}>
        Python
      </DocsHeading>
      <DocsCodeBlock label="Python verification" code={VERIFY_PYTHON} language="python" />
    </DocsArticle>
  )
}
