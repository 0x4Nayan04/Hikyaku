import { ArrowRight, CheckCircle2, LayoutDashboard, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { HeroDotGridWrap } from '@/components/landing/HeroDotGridWrap'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { getDefaultHomePath } from '@/lib/auth-redirect'
import { PRODUCT_LINKS } from '@/lib/app-meta'
import { useSession } from '@/providers/session-context'

const DELIVERIES = [
  { endpoint: 'api.acme.com/webhooks', status: '200', state: 'ok' as const },
  { endpoint: 'hooks.partner.io/events', status: '200', state: 'ok' as const },
  { endpoint: 'backup.svc.dev/hooks', status: 'retry', state: 'retry' as const },
]

function HeroDeliveryStage() {
  return (
    <div className="landing-hero-stage" aria-label="Webhook ingest and delivery preview">
      <div className="landing-hero-stage-panel flex flex-col sm:flex-row">
        <div className="landing-hero-stage-ingest-pane">
          <div className="landing-hero-stage-head">
            <div className="landing-hero-stage-ingest">
              <span className="landing-hero-stage-ingest-label">Ingest</span>
              <span className="landing-hero-stage-method">POST</span>
              <code className="landing-hero-stage-path">/v1/events</code>
            </div>
            <span className="landing-hero-stage-live">
              <span className="landing-hero-stage-live-dot" aria-hidden="true" />
              Fan-out active
            </span>
          </div>
          <ul className="landing-hero-stage-list">
            {DELIVERIES.map((item) => (
              <li
                key={item.endpoint}
                className={`landing-hero-stage-row landing-hero-stage-row--${item.state}`}
              >
                <span className="landing-hero-stage-endpoint">{item.endpoint}</span>
                <span
                  className={`landing-hero-stage-status landing-hero-stage-status--${item.state}`}
                >
                  {item.state === 'ok' ? (
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="landing-hero-stage-retry-icon size-3.5" aria-hidden="true" />
                  )}
                  <span className="landing-hero-stage-status-text">{item.status}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="landing-hero-stage-proof">
          <div className="landing-hero-proof-item">
            <ShieldCheck className="size-4 text-primary" strokeWidth={1.5} />
            <div>
              <span className="landing-hero-proof-value">HMAC-SHA256</span>
              <span className="landing-hero-proof-label">signed every delivery</span>
            </div>
          </div>
          <div className="landing-hero-proof-item">
            <TrendingUp className="size-4 text-primary" strokeWidth={1.5} />
            <div>
              <span className="landing-hero-proof-value">5× retries</span>
              <span className="landing-hero-proof-label">exponential backoff</span>
            </div>
          </div>
          <div className="landing-hero-proof-item">
            <RefreshCw className="size-4 text-primary" strokeWidth={1.5} />
            <div>
              <span className="landing-hero-proof-value">99.9%</span>
              <span className="landing-hero-proof-label">delivery success rate</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LandingHero() {
  const navigate = useNavigate()
  const { session, loading } = useSession()

  return (
    <section className="landing-hero" aria-labelledby="hero-heading">
      <HeroDotGridWrap wrapClassName="landing-hero-dot-grid">
        <LandingFrameInner className="landing-hero-inner">
          <div className="landing-hero-grid">
            <div className="landing-hero-content">
              <div className="landing-hero-chip">
                <span className="landing-hero-chip-tag">Open source</span>
                <span className="landing-hero-chip-text">Self-host or use our cloud</span>
              </div>

              <h1 id="hero-heading" className="landing-hero-title text-ink">
                One API call.{' '}
                <span className="hero-heading-em">
                  Signed delivery to every endpoint<span className="text-primary">.</span>
                </span>
              </h1>

              <p className="landing-hero-lead">
                POST events once. We fan out HMAC-signed HTTP deliveries to all your subscribers
                with automatic retries, full attempt logging, and a real-time ops console —
                zero queue infrastructure to build or maintain.
              </p>

              <div className="landing-hero-actions">
                {session ? (
                  <button
                    type="button"
                    onClick={() => navigate(getDefaultHomePath(session.user))}
                    className="sm-btn sm-btn-primary sm-btn-split focus-ring"
                  >
                    <span className="sm-btn-split-label">Go to dashboard</span>
                    <span className="sm-btn-split-icon">
                      <LayoutDashboard className="size-3.5" aria-hidden="true" />
                    </span>
                  </button>
                ) : !loading ? (
                  <button
                    type="button"
                    onClick={() => navigate('/signup')}
                    className="sm-btn sm-btn-primary sm-btn-split focus-ring"
                  >
                    <span className="sm-btn-split-label">Get started free</span>
                    <span className="sm-btn-split-icon">
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </span>
                  </button>
                ) : null}
                <Link to={PRODUCT_LINKS.docs} className="sm-btn sm-btn-ghost focus-ring">
                  View docs
                </Link>
              </div>
            </div>

            <HeroDeliveryStage />
          </div>
        </LandingFrameInner>
      </HeroDotGridWrap>
    </section>
  )
}
