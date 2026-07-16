import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsHeading } from '@/components/docs/DocsHeading'
import { DocsTable } from '@/components/docs/DocsTable'
import { API_BASE, API_ROUTES } from '@/docs/constants'

const TOC = [
  { id: 'routes', label: 'Routes', level: 2 as const },
  { id: 'pagination', label: 'Pagination', level: 2 as const },
  { id: 'auth', label: 'Auth requirements', level: 2 as const },
]

export function ApiReferencePage() {
  return (
    <DocsArticle
      slug="api-reference"
      title="API reference"
      description="Routes, auth rules, and pagination"
      toc={TOC}
    >
      <p className="docs-v2-prose">
        Base URL is <code>{API_BASE}</code> (from <code>VITE_API_URL</code> at build time). All routes sit under{' '}
        <code>/v1</code>.
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
