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
      description="Operate day-to-day from the browser"
      toc={TOC}
    >
      <p className="docs-v2-prose">
        After you <Link to="/signup">sign up</Link> (and a super-admin approves you) — or accept an invite — you land in
        a tenant workspace. Everything in the console is scoped to that tenant.
      </p>

      <DocsHeading id="tenant-console" level={2}>
        Tenant console
      </DocsHeading>
      <p className="docs-v2-prose">Use these pages to ship and debug without leaving the browser:</p>
      <ul className="docs-v2-list">
        <li>
          <strong>Dashboard</strong> — check whether deliveries are healthy (success rate, queue depth, recent
          activity).
        </li>
        <li>
          <strong>Endpoints</strong> — register a receiver URL and copy the signing secret shown once at create.
        </li>
        <li>
          <strong>Events</strong> — browse what you ingested and open an event to see its deliveries.
        </li>
        <li>
          <strong>Send event</strong> — fire a test payload from the UI when you do not want to use curl.
        </li>
        <li>
          <strong>Deliveries</strong> — filter by status, inspect attempt timelines, and replay failures.
        </li>
        <li>
          <strong>Settings</strong> — manage API keys, the browser-local endpoint secrets vault, and your account.
        </li>
      </ul>

      <DocsHeading id="admin" level={2}>
        Platform admin
      </DocsHeading>
      <p className="docs-v2-prose">
        Super-admins use <strong>Admin</strong> for platform ops: bootstrap once at{' '}
        <Link to="/bootstrap">/bootstrap</Link>, then manage tenants, users, invites, signup approvals, and the audit
        log. Super-admins are not tenant-scoped — they cannot open tenant dashboard pages.
      </p>
    </DocsArticle>
  )
}
