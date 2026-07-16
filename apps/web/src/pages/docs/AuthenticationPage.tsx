import { Link } from 'react-router-dom'

import { DocsApiRoute } from '@/components/docs/DocsApiRoute'
import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsCodeBlock } from '@/components/docs/DocsCodeBlock'
import { DocsHeading } from '@/components/docs/DocsHeading'
import { DocsTable } from '@/components/docs/DocsTable'

const TOC = [
  { id: 'auth-modes', label: 'Auth modes', level: 2 as const },
  { id: 'api-keys', label: 'API keys', level: 2 as const },
  { id: 'onboarding', label: 'Onboarding flows', level: 2 as const },
]

export function AuthenticationPage() {
  return (
    <DocsArticle
      slug="authentication"
      title="Authentication"
      description="API keys, console sessions, and how teams get access"
      toc={TOC}
    >
      <p className="docs-v2-prose">
        Use an API key for backends, a session cookie for the console, and a super-admin session for platform ops.
      </p>

      <DocsHeading id="auth-modes" level={2}>
        Auth modes
      </DocsHeading>
      <DocsTable label="Auth modes">
        <thead>
          <tr>
            <th>Mode</th>
            <th>How</th>
            <th>Scope</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>API key</td>
            <td>
              <code>Authorization: Bearer whk_…</code>
            </td>
            <td>Single tenant</td>
          </tr>
          <tr>
            <td>Session cookie</td>
            <td>Email/password login (httpOnly)</td>
            <td>Tenant user console + APIs</td>
          </tr>
          <tr>
            <td>Super-admin session</td>
            <td>Session cookie only</td>
            <td>
              <strong>Admin</strong> platform ops — not tenant-scoped
            </td>
          </tr>
        </tbody>
      </DocsTable>
      <DocsCodeBlock label="Authorization header" code="Authorization: Bearer whk_your_api_key" language="http" />

      <DocsHeading id="api-keys" level={2}>
        API keys
      </DocsHeading>
      <p className="docs-v2-prose">
        Keys belong to one tenant. The platform resolves the tenant from the key — never from the request body. The full
        secret is shown once on create or rotate; only a SHA-256 hash is stored.
      </p>
      <p className="docs-v2-prose">
        Passwords must be 12–128 characters. Browser login and API keys are separate credentials that resolve to the same
        tenant for tenant users.
      </p>

      <DocsHeading id="onboarding" level={2}>
        Onboarding flows
      </DocsHeading>
      <ul className="docs-v2-list">
        <li>
          <strong>Bootstrap</strong> — create the first super-admin once via{' '}
          <DocsApiRoute method="POST" path="/v1/auth/bootstrap" /> (requires <code>ADMIN_BOOTSTRAP_SECRET</code>).
        </li>
        <li>
          <strong>Signup</strong> — request access at <Link to="/signup">/signup</Link>; a super-admin approves or
          rejects on Admin.
        </li>
        <li>
          <strong>Invite</strong> — a super-admin creates a link via{' '}
          <DocsApiRoute method="POST" path="/v1/admin/invites" />; the recipient accepts at{' '}
          <Link to="/accept-invite">/accept-invite</Link>.
        </li>
      </ul>
    </DocsArticle>
  )
}
