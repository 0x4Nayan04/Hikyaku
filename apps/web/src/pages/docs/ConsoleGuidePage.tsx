import { Link } from 'react-router-dom'

import { DocsArticle } from '@/components/docs/DocsArticle'
import { DocsHeading } from '@/components/docs/DocsHeading'

const TOC = [
  { id: 'tenant-console', label: 'Tenant console', level: 2 as const },
  { id: 'admin', label: 'Platform admin', level: 2 as const },
]

export function ConsoleGuidePage() {
  return (
    <DocsArticle
      slug="console-guide"
      title="Console guide"
      description="Tenant pages and platform admin"
      toc={TOC}
    >
      <p className="docs-v2-prose">
        Fresh deploys bootstrap a super-admin at <Link to="/bootstrap">/bootstrap</Link>. Tenant
        users usually arrive via invite; <Link to="/signup">request access</Link> is secondary and
        needs approval. Console data is scoped to the signed-in tenant.
      </p>

      <DocsHeading id="tenant-console" level={2}>
        Tenant console
      </DocsHeading>
      <p className="docs-v2-prose">Pages available to tenant users:</p>
      <ul className="docs-v2-list">
        <li>
          <strong>Dashboard</strong> — ingest volume, queue depth, 24h outcomes, and recent
          activity.
        </li>
        <li>
          <strong>Endpoints</strong> — register a receiver URL and copy the signing secret shown
          once at create.
        </li>
        <li>
          <strong>Events</strong> — browse ingested events and open one to see its deliveries.
        </li>
        <li>
          <strong>Test event</strong> — POST a smoke-test payload from the UI (real traffic should
          use <code>POST /v1/events</code>).
        </li>
        <li>
          <strong>Deliveries</strong> — filter by status, inspect attempt timelines, and replay
          failures.
        </li>
        <li>
          <strong>Settings</strong> — API keys, an optional endpoint-secrets vault (session memory
          only — not durable storage), and account password. Super-admins see profile/password only;
          they have no API keys or vault tabs.
        </li>
      </ul>

      <DocsHeading id="admin" level={2}>
        Platform admin
      </DocsHeading>
      <p className="docs-v2-prose">
        Super-admins use <strong>Admin</strong> for platform operations: manage tenants, users,
        invites, signup approvals, and the audit log. Prefer inviting a tenant owner over ad-hoc
        signup requests. Super-admins are not tenant-scoped — they do not run tenant deliveries or
        hold tenant API keys.
      </p>
    </DocsArticle>
  )
}
