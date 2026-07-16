import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Search, Sparkles } from 'lucide-react'

import { LandingFrame } from '@/components/landing/LandingFrame'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingSectionBlock } from '@/components/landing/LandingSectionBlock'
import { DocsCallout } from '@/components/docs/DocsCallout'
import { DocsCodeBlock } from '@/components/docs/DocsCodeBlock'
import { DocsNavbar } from '@/components/docs/DocsNavbar'


const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const INGEST_CURL = `curl -X POST "${API_BASE}/v1/events" \
  -H "Authorization: Bearer whk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "order-123-paid",
    "type": "order.paid",
    "payload": { "order_id": "123", "amount": 4999 }
  }'`

const INGEST_RESPONSE = `{
  "id": "evt_uuid",
  "status": "pending",
  "created_at": "2026-06-05T12:00:00Z"
}`

const OUTBOUND_BODY = `{
  "id": "evt_uuid",
  "type": "order.paid",
  "created_at": "2026-06-05T12:00:00Z",
  "data": { "order_id": "123", "amount": 4999 }
}`

const VERIFY_NODE = `import crypto from 'node:crypto'

function verifyWebhook(rawBody, signatureHeader, timestamp, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest('hex')

  const received = signatureHeader.replace(/^sha256=/, '')
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(received, 'hex'),
  )
}`

const API_ROUTES = [
  { method: 'GET', path: '/v1/health', purpose: 'Liveness probe' },
  { method: 'GET', path: '/v1/ready', purpose: 'Postgres + Redis connectivity' },
  { method: 'POST', path: '/v1/auth/bootstrap', purpose: 'One-time super-admin bootstrap' },
  { method: 'POST', path: '/v1/auth/signup', purpose: 'Request tenant access (pending approval)' },
  { method: 'GET', path: '/v1/auth/invites/validate', purpose: 'Validate invite token' },
  { method: 'POST', path: '/v1/auth/accept-invite', purpose: 'Accept invite and create account' },
  { method: 'POST', path: '/v1/auth/login', purpose: 'Email/password login → session cookie' },
  { method: 'POST', path: '/v1/auth/logout', purpose: 'End session' },
  { method: 'GET', path: '/v1/auth/me', purpose: 'Current user + tenant' },
  { method: 'POST', path: '/v1/auth/change-password', purpose: 'Change password (session)' },
  { method: 'GET', path: '/v1/stats', purpose: 'Dashboard metrics (tenant auth)' },
  { method: 'GET', path: '/v1/api-keys', purpose: 'List API keys (prefix only)' },
  { method: 'POST', path: '/v1/api-keys', purpose: 'Create API key (shown once)' },
  { method: 'POST', path: '/v1/api-keys/:id/revoke', purpose: 'Revoke API key' },
  { method: 'POST', path: '/v1/api-keys/:id/rotate', purpose: 'Rotate API key (new key shown once)' },
  { method: 'POST', path: '/v1/endpoints', purpose: 'Create endpoint (secret shown once)' },
  { method: 'GET', path: '/v1/endpoints', purpose: 'List endpoints' },
  { method: 'PATCH', path: '/v1/endpoints/:id', purpose: 'Update status or description' },
  { method: 'POST', path: '/v1/events', purpose: 'Ingest event → 202 Accepted' },
  { method: 'GET', path: '/v1/events', purpose: 'List events (paginated)' },
  { method: 'GET', path: '/v1/events/:id', purpose: 'Event detail + delivery summary' },
  { method: 'GET', path: '/v1/deliveries/stream', purpose: 'SSE live delivery updates (session only)' },
  { method: 'GET', path: '/v1/deliveries', purpose: 'List deliveries' },
  { method: 'GET', path: '/v1/deliveries/:id', purpose: 'Delivery + attempt timeline' },
  { method: 'POST', path: '/v1/deliveries/:id/replay', purpose: 'Replay failed delivery → 202' },
  { method: 'GET', path: '/v1/admin/tenants', purpose: 'List tenants (super-admin)' },
  { method: 'POST', path: '/v1/admin/tenants', purpose: 'Create tenant or invite owner' },
  { method: 'POST', path: '/v1/admin/invites', purpose: 'Create tenant-owner or user invite' },
  { method: 'GET', path: '/v1/admin/signup-requests', purpose: 'List pending signup requests' },
  { method: 'POST', path: '/v1/admin/signup-requests/:id/approve', purpose: 'Approve signup request' },
  { method: 'GET', path: '/v1/admin/audit-log', purpose: 'Platform audit log' },
]

type DocItem = {
  id: string
  label: string
  description: string
  time: string
  badge: 'guide' | 'reference' | 'concept'
}

type DocGroup = {
  label: string
  items: DocItem[]
}

const DOCS_INDEX: DocGroup[] = [
  {
    label: 'Getting started',
    items: [
      { id: 'introduction', label: 'Introduction', description: 'Platform overview and key concepts', time: '3 min', badge: 'guide' },
      { id: 'quick-start', label: 'Quick start', description: 'Send your first event in minutes', time: '5 min', badge: 'guide' },
      { id: 'authentication', label: 'Authentication', description: 'API keys, sessions, and onboarding', time: '4 min', badge: 'guide' },
    ],
  },
  {
    label: 'Core concepts',
    items: [
      { id: 'ingest', label: 'Ingest events', description: 'POST events to the ingest API', time: '5 min', badge: 'concept' },
      { id: 'api-keys', label: 'API keys', description: 'Create, rotate, and revoke keys', time: '3 min', badge: 'concept' },
      { id: 'endpoints', label: 'Endpoints', description: 'Register and manage subscriber URLs', time: '4 min', badge: 'concept' },
      { id: 'outbound', label: 'Outbound deliveries', description: 'Webhook delivery format and headers', time: '4 min', badge: 'concept' },
      { id: 'signing', label: 'HMAC signing', description: 'Verify HMAC-SHA256 signatures', time: '6 min', badge: 'concept' },
    ],
  },
  {
    label: 'Platform reference',
    items: [
      { id: 'api-reference', label: 'API reference', description: 'All API routes and usage', time: '8 min', badge: 'reference' },
      { id: 'retries', label: 'Retries & rate limits', description: 'Retry policy and rate limits', time: '3 min', badge: 'reference' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'console-guide', label: 'Console guide', description: 'Browser console walkthrough', time: '5 min', badge: 'guide' },
      { id: 'privacy', label: 'Privacy & data', description: 'Security and data handling', time: '2 min', badge: 'reference' },
    ],
  },
]

function resolveScrollOffset() {
  const navHeight =
    parseFloat(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--nav-height')
        .replace('rem', ''),
    ) || 4
  const pxPerRem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return navHeight * pxPerRem + pxPerRem * 2
}

function Badge({ type }: { type: DocItem['badge'] }) {
  const styles: Record<string, string> = {
    guide: 'docs-badge--guide',
    concept: 'docs-badge--concept',
    reference: 'docs-badge--reference',
  }
  return <span className={`docs-badge ${styles[type]}`}>{type}</span>
}

export function Docs() {
  const [activeSection, setActiveSection] = useState(
    window.location.hash ? window.location.hash.slice(1) : 'introduction',
  )
  const [readingProgress, setReadingProgress] = useState(-1)
  const [searchQuery, setSearchQuery] = useState('')
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const flatItems = useMemo(() => DOCS_INDEX.flatMap(g => g.items.map(i => ({ ...i, groupLabel: g.label }))), [])

  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return flatItems
    const q = searchQuery.toLowerCase()
    return flatItems.filter(
      i =>
        i.label.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.groupLabel.toLowerCase().includes(q) ||
        i.badge.includes(q),
    )
  }, [searchQuery, flatItems])

  const scrollToSection = useCallback((id: string, smooth = true) => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      const el = document.getElementById(id)
      if (!el) {
        return
      }
      const offset = el.getBoundingClientRect().top + window.scrollY - resolveScrollOffset()
      window.scrollTo({ top: offset, behavior: smooth ? 'smooth' : 'instant' })
      window.history.replaceState(null, '', `#${id}`)
    }, smooth ? 50 : 0)
  }, [])

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('.docs-section'),
    )
    if (!sections.length) return

    const offset = resolveScrollOffset()

    let tick: ReturnType<typeof requestAnimationFrame>
    const update = () => {
      cancelAnimationFrame(tick)
      tick = requestAnimationFrame(() => {
        let current = sections[0].id
        for (const section of sections) {
          const top = section.getBoundingClientRect().top
          if (top <= offset) {
            current = section.id
          } else {
            break
          }
        }
        setActiveSection(current)

        const scrollTop = window.scrollY
        const docHeight =
          document.documentElement.scrollHeight - window.innerHeight
        setReadingProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0)
      })
    }

    if (window.location.hash) {
      scrollToSection(window.location.hash.slice(1), false)
    } else {
      update()
    }
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('hashchange', update)
    return () => {
      cancelAnimationFrame(tick)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      window.removeEventListener('scroll', update)
      window.removeEventListener('hashchange', update)
    }
  }, [scrollToSection])

  useEffect(() => {
    document.title = 'Documentation — Webhook Delivery'
  }, [])

  const handleTocClick = useCallback((id: string) => {
    scrollToSection(id)
    setSearchQuery('')
  }, [scrollToSection])

  return (
    <div className="landing-page docs-page flex min-h-screen flex-col">
      <LandingFrame>
        <DocsNavbar activeSection={activeSection} />
        <div
          className="docs-progress-bar"
          role="progressbar"
          aria-valuenow={readingProgress >= 0 ? Math.round(readingProgress * 100) : undefined}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Reading progress"
        >
          <div className="docs-progress-bar-inner">
            <div className="docs-progress-bar-track">
              <div
                className="docs-progress-bar-fill"
                style={{ transform: readingProgress >= 0 ? `scaleX(${readingProgress})` : 'scaleX(0)' }}
              />
            </div>
          </div>
        </div>
        <main id="main-content" className="flex-1">
          <article className="docs-article">
            <div className="docs-article-inner">
              <div className="docs-header">
                <h1 className="docs-header-title">Documentation</h1>
                <p className="docs-header-lead">
                  Everything you need to integrate, operate, and monitor your webhook delivery pipeline.
                </p>
              </div>

              <nav
                className="docs-mobile-toc"
                aria-label="Section navigation"
              >
                <select
                  className="docs-mobile-toc-select"
                  aria-label="Jump to section"
                  onChange={(e) => {
                    if (e.target.value) {
                      scrollToSection(e.target.value)
                    }
                  }}
                >
                  <option value="">Jump to section…</option>
                  {DOCS_INDEX.map((group) =>
                    group.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {group.label} — {item.label}
                      </option>
                    )),
                  )}
                </select>
              </nav>

              <div className="docs-layout">
                <nav className="docs-toc" aria-label="Documentation sections">
                  <p className="docs-toc-label">Sections</p>
                  {DOCS_INDEX.map((group) => (
                    <div key={group.label} className="docs-toc-group">
                      <p className="docs-toc-group-label">{group.label}</p>
                      <ul className="docs-toc-list">
                        {group.items.map((item) => (
                          <li key={item.id}>
                            <a
                              href={`#${item.id}`}
                              onClick={(e) => {
                                e.preventDefault()
                                handleTocClick(item.id)
                              }}
                              aria-current={
                                activeSection === item.id ? 'page' : undefined
                              }
                            >
                              {item.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </nav>

                <div className="docs-content">
                  <div className="docs-search-wrapper">
                    <Search className="docs-search-icon" size={16} aria-hidden="true" />
                    <input
                      ref={searchRef}
                      type="search"
                      className="docs-search-input"
                      placeholder="Search documentation…"
                      aria-label="Search documentation"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {searchQuery.trim() && filteredCards.length === 0 ? (
                    <div className="docs-search-empty">
                      <p>No results found for <strong>"{searchQuery}"</strong></p>
                      <p className="docs-search-empty-hint">Try a different search term or browse the sections below.</p>
                    </div>
                  ) : searchQuery.trim() ? (
                    <div className="docs-card-grid">
                      {filteredCards.map((item) => (
                        <a
                          key={item.id}
                          href={`#${item.id}`}
                          className="docs-card"
                          onClick={(e) => {
                            e.preventDefault()
                            handleTocClick(item.id)
                          }}
                        >
                          <span className="docs-card-header">
                            <Badge type={item.badge} />
                            <span className="docs-card-time">
                              <Clock size={12} aria-hidden="true" />
                              {item.time}
                            </span>
                          </span>
                          <span className="docs-card-title">{item.label}</span>
                          <span className="docs-card-desc">{item.description}</span>
                          <span className="docs-card-group-label">{item.groupLabel}</span>
                        </a>
                      ))}
                    </div>
                  ) : null}

                  {!searchQuery.trim() ? (
                    <>
                      <div className="docs-start-here">
                        <span className="docs-start-here-head">
                          <Sparkles size={16} aria-hidden="true" />
                          <span>Start here</span>
                        </span>
                        <p className="docs-start-here-text">
                          New to Webhook Delivery? Begin with the <a href="#introduction" onClick={(e) => { e.preventDefault(); handleTocClick('introduction') }}>Introduction</a> and <a href="#quick-start" onClick={(e) => { e.preventDefault(); handleTocClick('quick-start') }}>Quick start</a> guides to send your first event in under 5 minutes.
                        </p>
                      </div>

                      {DOCS_INDEX.map((group) => (
                        <div key={group.label} className="docs-card-section">
                          <h2 className="docs-card-section-title">{group.label}</h2>
                          <div className="docs-card-grid">
                            {group.items.map((item) => (
                              <a
                                key={item.id}
                                href={`#${item.id}`}
                                className="docs-card"
                                onClick={(e) => {
                                  e.preventDefault()
                                  handleTocClick(item.id)
                                }}
                              >
                                <span className="docs-card-header">
                                  <Badge type={item.badge} />
                                  <span className="docs-card-time">
                                    <Clock size={12} aria-hidden="true" />
                                    {item.time}
                                  </span>
                                </span>
                                <span className="docs-card-title">{item.label}</span>
                                <span className="docs-card-desc">{item.description}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : null}

                  <section id="introduction" className="docs-section">
                    <h2 className="docs-section-title">Introduction</h2>
                    <p className="docs-prose">
                      Webhook Delivery is a multi-tenant webhook platform. You
                      send an event to the ingest API; the platform fans it out
                      to every active endpoint for your tenant, signs each
                      outbound POST, retries transient failures, and records
                      every attempt in the operator console.
                    </p>
                    <ul className="docs-list">
                      <li>
                        <strong>Endpoint</strong> — the URL that receives
                        signed webhook POSTs.
                      </li>
                      <li>
                        <strong>Event</strong> — a JSON message you ingest
                        (type + payload).
                      </li>
                      <li>
                        <strong>Delivery</strong> — one fan-out attempt to an
                        endpoint, with retries.
                      </li>
                      <li>
                        <strong>API key</strong> — programmatic auth for
                        ingest and management (<code>whk_…</code>).
                      </li>
                    </ul>
                  </section>

                  <section id="quick-start" className="docs-section">
                    <h2 className="docs-section-title">Quick start</h2>
                    <p className="docs-prose">
                      <strong>Console path:</strong> bootstrap at{' '}
                      <Link to="/bootstrap">/bootstrap</Link> (first deploy),
                      approve a signup or invite a tenant on{' '}
                      <strong>Admin</strong>, sign in as tenant owner, then:
                    </p>
                    <ol className="docs-ordered-list">
                      <li>
                        <strong>Endpoints</strong> — register a receiver URL
                        (e.g. webhook.site).
                      </li>
                      <li>
                        <strong>Settings → API keys</strong> — optional for
                        browser-only testing; required for backend ingest.
                      </li>
                      <li>
                        <strong>Send event</strong> — fire a test payload, or
                        use the curl example below.
                      </li>
                      <li>
                        <strong>Deliveries</strong> — confirm status and
                        inspect attempts.
                      </li>
                    </ol>
                    <p className="docs-prose">
                      <strong>API-only path:</strong> run{' '}
                      <code>pnpm db:seed</code> and copy a printed{' '}
                      <code>whk_…</code> key, then ingest:
                    </p>
                    <DocsCodeBlock label="Ingest event" code={INGEST_CURL} />
                    <p className="docs-prose">
                      A successful ingest returns{' '}
                      <code>202 Accepted</code> with the event id. The platform
                      enqueues one delivery per active endpoint. The background
                      worker must be running (<code>pnpm dev</code> includes
                      it).
                    </p>
                  </section>

                  <section id="authentication" className="docs-section">
                    <h2 className="docs-section-title">Authentication</h2>
                    <p className="docs-prose">
                      Programmatic API calls use a tenant API key in the
                      Authorization header:
                    </p>
                    <DocsCodeBlock
                      label="Authorization header"
                      code="Authorization: Bearer whk_your_api_key"
                    />
                    <p className="docs-prose">
                      API keys are scoped to a single tenant. The platform
                      resolves <code>tenant_id</code> from the key — never from
                      the request body. Keys are shown once on creation; only a
                      SHA-256 hash is stored server-side.
                    </p>
                    <p className="docs-prose">
                      The operator console uses an httpOnly session cookie
                      after email/password login. Browser and API auth are
                      separate; both resolve to the same tenant scope for
                      tenant users. Super-admins use session auth only and
                      manage the platform from <strong>Admin</strong>.
                    </p>
                    <p className="docs-prose">
                      <strong>Onboarding flows:</strong>
                    </p>
                    <ul className="docs-list">
                      <li>
                        <strong>Bootstrap</strong> — one-time super-admin at{' '}
                        <code>POST /v1/auth/bootstrap</code> (requires{' '}
                        <code>ADMIN_BOOTSTRAP_SECRET</code>).
                      </li>
                      <li>
                        <strong>Signup</strong> — public request at{' '}
                        <Link to="/signup">/signup</Link>; super-admin approves
                        on Admin.
                      </li>
                      <li>
                        <strong>Invite</strong> — super-admin creates a link via{' '}
                        <code>POST /v1/admin/invites</code>; recipient accepts at{' '}
                        <Link to="/accept-invite">/accept-invite</Link>.
                      </li>
                    </ul>
                  </section>

                  <section id="ingest" className="docs-section">
                    <h2 className="docs-section-title">Ingest events</h2>
                    <p className="docs-prose">
                      <code>POST /v1/events</code> accepts:
                    </p>
                    <DocsCodeBlock
                      label="Request body"
                      code={`{
  "idempotency_key": "order-123-paid",
  "type": "order.paid",
  "payload": { "order_id": "123", "amount": 4999 }
}`}
                    />
                    <DocsCodeBlock label="Response (202)" code={INGEST_RESPONSE} />
                    <DocsCallout variant="info" label="Idempotency">
                      <p>
                        Submitting the same{' '}
                        <code>idempotency_key</code> for a tenant returns the
                        existing event with <code>202</code> — no duplicate
                        fan-out or delivery rows.
                      </p>
                    </DocsCallout>
                  </section>

                  <section id="api-keys" className="docs-section">
                    <h2 className="docs-section-title">API keys</h2>
                    <p className="docs-prose">
                      Manage keys in <strong>Settings → API keys</strong> or via
                      the API. Each key belongs to one tenant and is shown in
                      full only on create or rotate.
                    </p>
                    <DocsCodeBlock
                      label="Create API key"
                      code={`curl -X POST ${API_BASE}/v1/api-keys \\
  -H "Authorization: Bearer whk_your_api_key" \\
  -H "Content-Type: application/json"`}
                    />
                    <p className="docs-prose">
                      List responses include <code>prefix</code> (e.g.{' '}
                      <code>whk_abcd</code>) for identification — never the full
                      secret. Revoke compromised keys with{' '}
                      <code>POST /v1/api-keys/:id/revoke</code>; rotate with{' '}
                      <code>POST /v1/api-keys/:id/rotate</code> to issue a new
                      key and invalidate the old one.
                    </p>
                  </section>

                  <section id="endpoints" className="docs-section">
                    <h2 className="docs-section-title">Endpoints</h2>
                    <p className="docs-prose">
                      Register subscriber URLs with{' '}
                      <code>POST /v1/endpoints</code>. The signing secret (
                      <code>whsec_…</code>) is returned once at creation.
                      Endpoint URLs are immutable after create; use{' '}
                      <code>PATCH /v1/endpoints/:id</code> to disable or
                      update the description.
                    </p>
                    <p className="docs-prose">
                      In the console, open{' '}
                      <strong>Endpoints → Create endpoint</strong>, paste your
                      receiver URL (e.g. webhook.site or ngrok), and
                      optionally save the secret to this browser under Settings
                      → Endpoint secrets.
                    </p>
                  </section>

                  <section id="outbound" className="docs-section">
                    <h2 className="docs-section-title">
                      Outbound deliveries
                    </h2>
                    <p className="docs-prose">
                      Subscribers receive a JSON body:
                    </p>
                    <DocsCodeBlock
                      label="Delivery body"
                      code={OUTBOUND_BODY}
                    />
                    <p className="docs-prose">With headers:</p>
                    <DocsCodeBlock
                      label="Delivery headers"
                      code={`Content-Type: application/json
X-Webhook-Id: <delivery_uuid>
X-Webhook-Timestamp: <unix_seconds>
X-Webhook-Signature: sha256=<hmac_hex>
User-Agent: WebhookDelivery/1.0`}
                    />
                    <p className="docs-prose">
                      <code>X-Webhook-Id</code> is the delivery UUID — stable
                      across all retry attempts for that event×endpoint pair.
                      Use it to dedupe under at-least-once delivery.
                    </p>
                    <p className="docs-prose">
                      Inspect deliveries with <code>GET /v1/deliveries</code>{' '}
                      (optional <code>?status=failed</code> filter) and{' '}
                      <code>GET /v1/deliveries/:id</code> for the attempt
                      timeline. The console uses{' '}
                      <code>GET /v1/deliveries/stream</code> (SSE, session
                      cookie) for live updates with polling fallback.
                    </p>
                  </section>

                  <section id="signing" className="docs-section">
                    <h2 className="docs-section-title">HMAC signing</h2>
                    <p className="docs-prose">
                      Sign the string{' '}
                      <code>
                        {'{timestamp}.{raw_request_body}'}
                      </code>{' '}
                      (the format is <code>timestamp.raw_body</code>, UTF-8 concatenation)
                      with the endpoint secret as the
                      HMAC-SHA256 key. Emit{' '}
                      <code>sha256=&lt;hex&gt;</code> in{' '}
                      <code>X-Webhook-Signature</code>. Receivers must verify
                      using the raw body bytes before JSON parsing.
                    </p>
                    <DocsCodeBlock
                      label="Node.js verification"
                      code={VERIFY_NODE}
                    />
                  </section>

                  <section id="api-reference" className="docs-section">
                    <h2 className="docs-section-title">API reference</h2>
                    <p className="docs-prose">
                      Base URL: <code>{API_BASE}</code> (set via{' '}
                      <code>VITE_API_URL</code> at build time). All routes are
                      prefixed with <code>/v1</code>.
                    </p>
                    <div className="docs-table-wrap">
                      <table className="docs-table">
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
                                <span
                                  className={`docs-method-badge docs-method-badge--${route.method.toLowerCase()}`}
                                >
                                  {route.method}
                                </span>
                              </td>
                              <td>
                                <code>{route.path}</code>
                              </td>
                              <td>{route.purpose}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="docs-prose">
                      List endpoints support pagination:{' '}
                      <code>?limit=50&amp;offset=0</code> (default limit 50,
                      max 100). Response shape:{' '}
                      <code>{'{ data, total, limit, offset }'}</code>.
                    </p>
                    <p className="docs-prose">
                      <strong>Auth requirements:</strong> tenant routes accept
                      Bearer API key or tenant session cookie.{' '}
                      <code>/v1/deliveries/stream</code> requires a session
                      cookie. <code>/v1/admin/*</code> routes require a
                      super-admin session. Auth routes (
                      <code>/v1/auth/*</code>) are public except logout, me, and
                      change-password.
                    </p>
                  </section>

                  <section id="retries" className="docs-section">
                    <h2 className="docs-section-title">
                      Retries &amp; rate limits
                    </h2>
                    <div className="docs-table-wrap">
                      <table className="docs-table">
                        <thead>
                          <tr>
                            <th>Setting</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Max HTTP attempts</td>
                            <td>5 per delivery</td>
                          </tr>
                          <tr>
                            <td>Backoff</td>
                            <td>
                              Exponential + jitter (~1m → 2m → 4m → 8m, cap
                              1h)
                            </td>
                          </tr>
                          <tr>
                            <td>Success</td>
                            <td>HTTP 2xx within 30s</td>
                          </tr>
                          <tr>
                            <td>Retryable</td>
                            <td>Network error, timeout, 408, 429, 5xx</td>
                          </tr>
                          <tr>
                            <td>Fail-fast</td>
                            <td>4xx (except 408, 429)</td>
                          </tr>
                          <tr>
                            <td>Rate limit</td>
                            <td>
                              100 HTTP delivery attempts / minute / tenant
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <DocsCallout variant="info" label="Rate limiting">
                      <p>
                        When rate-limited, jobs defer for 60s without counting
                        as failed or toward the 5-attempt cap. Inspect deferred
                        and failed deliveries in the console under{' '}
                        <strong>Deliveries</strong>.
                      </p>
                    </DocsCallout>
                    <p className="docs-prose">
                      <strong>Replay:</strong> failed deliveries can be
                      re-queued with{' '}
                      <code>POST /v1/deliveries/:id/replay</code> (returns{' '}
                      <code>202</code>). Only <code>failed</code> status is
                      replayable. The console exposes the same action on the
                      delivery detail page.
                    </p>
                  </section>

                  <section id="console-guide" className="docs-section">
                    <h2 className="docs-section-title">Console guide</h2>
                    <ol className="docs-ordered-list">
                      <li>
                        <strong>Sign up</strong> at{' '}
                        <Link to="/signup">/signup</Link> and wait for
                        super-admin approval, or accept an invite link.
                      </li>
                      <li>
                        <strong>Endpoints</strong> — register receiver URLs
                        and copy signing secrets.
                      </li>
                      <li>
                        <strong>Settings</strong> — create an API key for
                        programmatic ingest.
                      </li>
                      <li>
                        <strong>Send event</strong> — fire a test payload
                        without curl.
                      </li>
                      <li>
                        <strong>Deliveries</strong> — inspect attempts, HTTP
                        status, and replay failures.
                      </li>
                      <li>
                        <strong>Dashboard</strong> — 24h success rate, queue
                        depth, and recent activity (polls every 10s).
                      </li>
                    </ol>
                    <p className="docs-prose">
                      Each tenant is an isolated workspace: API keys, endpoints,
                      events, and deliveries never cross tenant boundaries.
                      Users belong to exactly one tenant.
                    </p>
                    <p className="docs-prose">
                      Super-admins bootstrap once at{' '}
                      <Link to="/bootstrap">/bootstrap</Link>, then manage
                      tenants from <strong>Admin</strong>. Super-admins are
                      not tenant-scoped — they cannot open tenant dashboard
                      pages.
                    </p>
                  </section>

                  <section id="privacy" className="docs-section">
                    <h2 className="docs-section-title">
                      Privacy &amp; data
                    </h2>
                    <p className="docs-prose">
                      API keys are stored hashed. Endpoint signing secrets are
                      recoverable server-side for HMAC (shown once at
                      creation). Session cookies power the operator console.
                      Delivery attempt logs may include truncated response
                      bodies (~1KB) for debugging.
                    </p>
                    <DocsCallout variant="danger">
                      <p>
                        Do not commit API keys or signing secrets to source
                        control. Revoke compromised keys from Settings and
                        rotate endpoint secrets by creating a new endpoint.
                      </p>
                    </DocsCallout>
                  </section>


                </div>
              </div>
            </div>
          </article>
        </main>

        <LandingSectionBlock className="site-footer-block">
          <LandingFooter />
        </LandingSectionBlock>
      </LandingFrame>
    </div>
  )
}
