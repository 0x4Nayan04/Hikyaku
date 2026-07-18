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
        After you <Link to="/signup">request access</Link> (and a super-admin approves) — or accept
        an invite — you land in a tenant workspace. Console data is scoped to that tenant.
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
          <strong>Send event</strong> — POST a test payload from the UI.
        </li>
        <li>
          <strong>Deliveries</strong> — filter by status, inspect attempt timelines, and replay
          failures.
        </li>
        <li>
          <strong>Settings</strong> — API keys, browser-local endpoint secrets vault, and account
          password.
        </li>
      </ul>

      <DocsHeading id="admin" level={2}>
        Platform admin
      </DocsHeading>
      <p className="docs-v2-prose">
        Super-admins use <strong>Admin</strong> for platform operations: bootstrap once at{' '}
        <Link to="/bootstrap">/bootstrap</Link>, then manage tenants, users, invites, signup
        approvals, and the audit log. Super-admins are not tenant-scoped — they cannot open tenant
        dashboard pages.
      </p>
    </DocsArticle>
  )
}
