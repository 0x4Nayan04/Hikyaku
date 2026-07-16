import { ArrowRight, CheckCircle2, Clock, ExternalLink, Globe, RefreshCw, ShieldCheck, Layers } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { PRODUCT_LINKS } from '@/lib/app-meta'

const PROOF_METRICS = [
  { label: 'Endpoints managed', value: 'Unlimited' },
  { label: 'Retries per delivery', value: 'Up to 5' },
  { label: 'Setup time', value: '< 5 min' },
  { label: 'Tenant isolation', value: 'Built-in' },
]

const FEATURES = [
  {
    icon: Globe,
    title: 'Fan-out',
    description: 'One POST fans out to every registered endpoint — no broadcast logic to write.',
  },
  {
    icon: ShieldCheck,
    title: 'HMAC signing',
    description: 'Every delivery includes a verifiable signature. Receivers authenticate without you maintaining a signing service.',
  },
  {
    icon: RefreshCw,
    title: 'Retries with visibility',
    description: 'Exponential backoff, attempt logs, and console replay — not a black-box proxy.',
  },
  {
    icon: Layers,
    title: 'Multi-tenant',
    description: 'Isolated workspaces with scoped API keys and endpoint secrets from day one.',
  },
]

const RECENT_DELIVERIES = [
  { endpoint: 'api.acme.com/webhooks', status: '200', time: '2s ago' },
  { endpoint: 'hooks.partner.io/events', status: '200', time: '12s ago' },
  { endpoint: 'backup.svc.dev/hooks', status: 'retry', time: '45s ago' },
  { endpoint: 'events.stripe.com/live', status: '200', time: '1m ago' },
]

export function LandingConsolePreview() {
  const navigate = useNavigate()

  return (
    <section
      id="console"
      className="scroll-mt-[calc(var(--nav-height)+var(--section-bar-height))] border-t border-border bg-background-alt"
      aria-labelledby="console-heading"
    >
      <LandingFrameInner className="landing-console-section">
        <header className="landing-console-header">
          <div className="landing-console-header-copy">
            <p className="landing-section-kicker">Operator console</p>
            <h2 id="console-heading" className="landing-section-title text-ink">
              See every delivery. Control every retry.
            </h2>
            <p className="landing-section-lead">
              Manage endpoints, inspect attempt logs, send test events, and monitor live
              delivery health — all from a single dashboard.
            </p>
            <div className="landing-console-actions">
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="sm-btn sm-btn-primary sm-btn-split focus-ring"
              >
                <span className="sm-btn-split-label">Open console</span>
                <span className="sm-btn-split-icon">
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </button>
              <Link
                to={`${PRODUCT_LINKS.docs}#api-reference`}
                className="sm-btn sm-btn-secondary focus-ring"
              >
                API reference
              </Link>
            </div>
          </div>
          <div className="landing-console-metrics">
            {PROOF_METRICS.map((m) => (
              <div key={m.label} className="landing-console-metric">
                <span className="landing-console-metric-value">{m.value}</span>
                <span className="landing-console-metric-label">{m.label}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="landing-console-body">
          <div className="landing-console-dashboard">
            <div className="landing-console-dashboard-head">
              <div className="landing-console-dashboard-dots" aria-hidden="true">
                <span /><span /><span />
              </div>
              <span className="landing-console-dashboard-url">app.webhook.delivery/deliveries</span>
              <ExternalLink className="size-3 text-muted" strokeWidth={1.5} />
            </div>
            <div className="landing-console-dashboard-body">
              <div className="landing-console-stats-row">
                <div className="landing-console-stat">
                  <span className="landing-console-stat-label">Active endpoints</span>
                  <span className="landing-console-stat-value">12</span>
                </div>
                <div className="landing-console-stat">
                  <span className="landing-console-stat-label">Deliveries (24h)</span>
                  <span className="landing-console-stat-value">1,847</span>
                </div>
                <div className="landing-console-stat">
                  <span className="landing-console-stat-label">Success rate</span>
                  <span className="landing-console-stat-value text-success">99.3%</span>
                </div>
                <div className="landing-console-stat">
                  <span className="landing-console-stat-label">Pending retries</span>
                  <span className="landing-console-stat-value text-warning">3</span>
                </div>
              </div>
              <div className="landing-console-feed">
                <span className="landing-console-feed-label">Recent deliveries</span>
                <ul className="landing-console-feed-list">
                  {RECENT_DELIVERIES.map((d) => (
                    <li key={d.endpoint} className="landing-console-feed-item">
                      <span className={`landing-console-feed-dot landing-console-feed-dot--${d.status}`} />
                      <code className="landing-console-feed-endpoint">{d.endpoint}</code>
                      <span className="landing-console-feed-status">
                        {d.status === 'retry' ? (
                          <RefreshCw className="size-3" strokeWidth={1.5} />
                        ) : (
                          <CheckCircle2 className="size-3" strokeWidth={1.5} />
                        )}
                        {d.status === 'retry' ? 'Retrying' : d.status}
                      </span>
                      <span className="landing-console-feed-time">
                        <Clock className="size-3" strokeWidth={1.5} />
                        {d.time}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="landing-console-features">
            <p className="landing-console-features-kicker">Everything you need</p>
            <ul className="landing-console-features-list">
              {FEATURES.map((f) => (
                <li key={f.title} className="landing-console-feature">
                  <span className="landing-console-feature-icon" aria-hidden="true">
                    <f.icon className="size-4" strokeWidth={1.5} />
                  </span>
                  <div>
                    <span className="landing-console-feature-title">{f.title}</span>
                    <p className="landing-console-feature-desc">{f.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </LandingFrameInner>
    </section>
  )
}
