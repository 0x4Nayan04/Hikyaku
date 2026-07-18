import { useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { PRODUCT_LINKS } from '@/lib/app-meta'
import { cn } from '@/lib/utils'

const VIEWS = {
  deliveries: {
    label: 'Deliveries',
    src: '/landing/console-deliveries.png',
    alt: 'Hikyaku deliveries list with status and attempt details',
  },
  dashboard: {
    label: 'Dashboard',
    src: '/landing/console-dashboard.png',
    alt: 'Hikyaku dashboard with delivery metrics and recent activity',
  },
} as const

export function LandingConsolePreview() {
  const navigate = useNavigate()
  const [activeView, setActiveView] = useState<keyof typeof VIEWS>('deliveries')
  const view = VIEWS[activeView]

  return (
    <section id="console" className="lp-console" aria-labelledby="console-heading">
      <LandingFrameInner className="lp-section">
        <header className="lp-console__heading">
          <div className="lp-section-heading">
            <p className="lp-kicker">Delivery console</p>
            <h2 id="console-heading">Inspect deliveries when they fail</h2>
            <p>
              Browse events and deliveries, open an attempt for status and response body, then
              replay after the endpoint recovers.
            </p>
          </div>
          <div className="lp-console__actions">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="lp-button lp-button--primary focus-ring"
            >
              Sign in <ArrowRight className="size-4" aria-hidden="true" />
            </button>
            <Link
              to={`${PRODUCT_LINKS.docs}/api-reference`}
              className="lp-text-link lp-console__reference focus-ring"
            >
              <Search className="size-4" aria-hidden="true" /> API reference
            </Link>
          </div>
        </header>

        <figure className="lp-product-shot">
          <div className="lp-product-shot__toolbar">
            <div className="lp-product-shot__tabs" role="tablist" aria-label="Console screenshots">
              {(Object.keys(VIEWS) as Array<keyof typeof VIEWS>).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeView === key}
                  className={cn(activeView === key && 'is-active')}
                  onClick={() => setActiveView(key)}
                >
                  {VIEWS[key].label}
                </button>
              ))}
            </div>
          </div>
          <div className="lp-product-shot__viewport">
            <img key={view.src} src={view.src} alt={view.alt} loading="lazy" />
          </div>
          <figcaption>
            Console screenshots with sample workspace data.
          </figcaption>
        </figure>
      </LandingFrameInner>
    </section>
  )
}
