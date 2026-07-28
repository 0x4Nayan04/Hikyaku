import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsHeading } from '@/components/docs/DocsHeading'
import { DocsTable } from '@/components/docs/DocsTable'
import { API_ROUTES } from '@/docs/constants'

export function ApiReferencePage() {
  return (
    <DocsArticle
      slug="api-reference"
      title="API reference"
      description="Routes, auth rules, and pagination"
    >
      <p className="docs-v2-prose">
        All routes sit under <code>/v1</code>. The base URL is the app's API origin,
        set via <code>VITE_API_URL</code> at build time.
      </p>

      <DocsHeading id="routes" level={2}>
        Routes
      </DocsHeading>
      <DocsTable label="Routes">
        <thead>
          <tr>
            <th>Method</th>
            <th>Route</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          {API_ROUTES.map((route) => (
            <tr key={`${route.method}-${route.path}`}>
              <td>
                <span className={`docs-v2-method docs-v2-method--${route.method.toLowerCase()}`}>{route.method}</span>
              </td>
              <td>
                <code>{route.path}</code>
              </td>
              <td>{route.purpose}</td>
            </tr>
          ))}
        </tbody>
      </DocsTable>

      <DocsHeading id="pagination" level={2}>
        Pagination
      </DocsHeading>
      <p className="docs-v2-prose">
        List endpoints accept <code>?limit=50&amp;offset=0</code> (default limit 50, max 100). Responses look like{' '}
        <code>{'{ data, total, limit, offset }'}</code>.
      </p>

      <DocsHeading id="auth" level={2}>
        Auth requirements
      </DocsHeading>
      <p className="docs-v2-prose">
        Tenant routes accept a Bearer API key or a tenant session cookie. The deliveries stream requires a session
        cookie. Admin routes require a super-admin session. Auth routes are public except logout, me, and
        change-password.
      </p>
    </DocsArticle>
  )
}
