import {
  ArrowRight,
  Check,
  CheckCircle2,
  LayoutDashboard,
  RadioTower,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { getDefaultHomePath } from '@/lib/auth-redirect'
import { PRODUCT_LINKS } from '@/lib/app-meta'
import { useSession } from '@/providers/session-context'

const DESTINATIONS = [
  { name: 'Billing service', endpoint: 'billing.acme.dev/events', status: 'Delivered', time: '142 ms' },
  { name: 'CRM sync', endpoint: 'hooks.partner.io/hikyaku', status: 'Delivered', time: '186 ms' },
  { name: 'Data archive', endpoint: 'archive.acme.dev/webhooks', status: 'Retrying', time: '8s' },
]

function DeliveryPreview() {
  return (
    <div className="lp-route-map" aria-label="Webhook event routing preview">
      <div className="lp-route-map__header">
        <span className="lp-live-pill">
          <span aria-hidden="true" /> Delivery in progress
        </span>
        <span>3 destinations</span>
      </div>

      <div className="lp-route-map__body">
        <div className="lp-route-map__origin">
          <span className="lp-route-map__icon" aria-hidden="true">
            <Send className="size-4" />
          </span>
          <span>Your application</span>
          <strong>order.created</strong>
          <code>evt_7f2a</code>
        </div>

        <div className="lp-route-map__handoff" aria-hidden="true">
          <span />
          <ArrowRight className="size-4" />
        </div>

        <div className="lp-route-map__router">
          <span className="lp-route-map__icon" aria-hidden="true">
            <RadioTower className="size-5" />
          </span>
          <div>
            <strong>Hikyaku</strong>
            <span>signs · retries · records</span>
          </div>
        </div>

        <div className="lp-route-map__fanout" aria-hidden="true">
          <span />
          <ArrowRight className="size-4" />
        </div>

        <ul className="lp-route-map__destinations">
          {DESTINATIONS.map((destination) => (
            <li key={destination.name} className={destination.status === 'Retrying' ? 'is-retrying' : undefined}>
              {destination.status === 'Retrying' ? (
                <RefreshCw className="size-4 lp-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
            <div>
                <strong>{destination.name}</strong>
                <code>{destination.endpoint}</code>
              </div>
              <span>
                {destination.status} <time>{destination.time}</time>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="lp-route-map__footer">
        <ShieldCheck className="size-4" aria-hidden="true" />
        <span>HMAC-SHA256 signed</span>
        <span>attempt history</span>
      </div>
    </div>
  )
}

export function LandingHero() {
  const navigate = useNavigate()
  const { session, loading } = useSession()

  return (
    <section className="lp-hero" aria-labelledby="hero-heading">
      <LandingFrameInner className="lp-hero__inner">
        <div className="lp-hero__copy">
          <p className="lp-eyebrow">
            <span aria-hidden="true">飛脚</span>
            Webhook delivery
          </p>
          <h1 id="hero-heading">Send a webhook once. Track each attempt.</h1>
          <p className="lp-hero__lead">
            POST an event to the API. Hikyaku fans it out to your endpoints with HMAC-SHA256
            signatures, retries failures with exponential backoff, and stores attempt-level history.
          </p>

          <div className="lp-hero__actions">
            {session ? (
              <button
                type="button"
                onClick={() => navigate(getDefaultHomePath(session.user))}
                className="lp-button lp-button--primary focus-ring"
              >
                Go to dashboard
                <LayoutDashboard className="size-4" aria-hidden="true" />
              </button>
            ) : !loading ? (
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="lp-button lp-button--primary focus-ring"
              >
                Request access
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            ) : null}
            <Link to={PRODUCT_LINKS.docs} className="lp-button lp-button--secondary focus-ring">
              Read the docs
            </Link>
          </div>

          <ul className="lp-hero__proof" aria-label="Product capabilities">
            <li>
              <Check className="size-4" aria-hidden="true" /> HMAC-SHA256
            </li>
            <li>
              <Check className="size-4" aria-hidden="true" /> Exponential backoff
            </li>
            <li>
              <Check className="size-4" aria-hidden="true" /> Attempt logs
            </li>
          </ul>
        </div>

        <DeliveryPreview />
      </LandingFrameInner>
    </section>
  )
}
