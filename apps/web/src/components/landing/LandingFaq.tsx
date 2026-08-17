import { useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { PRODUCT_LINKS } from '@/lib/app-meta'

const FAQ_ITEMS = [
  {
    id: 'get-started',
    q: 'How do I get started?',
  },
  {
    id: 'failures',
    q: 'What if my endpoint is down?',
    a: 'Hikyaku retries with exponential backoff, up to five HTTP attempts. Each attempt records status, timing, and body. Replay from the console when the endpoint recovers.',
  },
  {
    id: 'signing',
    q: 'How are deliveries signed?',
    a: 'Each delivery sends X-Webhook-Timestamp and X-Webhook-Signature — HMAC-SHA256 of timestamp.raw_body. Verify against the raw body before parsing JSON.',
  },
  {
    id: 'limits',
    q: 'Are there rate limits?',
    a: 'Outbound delivery is capped per tenant. Over the cap, deliveries stay pending and retry later — they do not burn an attempt.',
  },
  {
    id: 'tenancy',
    q: 'How is tenant data isolated?',
    a: 'Each tenant has its own API keys, endpoints, events, and delivery history. Keys are hashed; endpoint secrets are shown once. Super-admins manage tenants from Admin.',
  },
  {
    id: 'pricing',
    q: 'Is there billing?',
    a: 'No. This is a self-hosted project with no paid plans. A platform admin invites each tenant owner. Per-tenant rate limits still apply.',
  },
] as const

type FaqItem = (typeof FAQ_ITEMS)[number]

function FaqAnswerBody({ item }: { item: FaqItem }) {
  switch (item.id) {
    case 'get-started':
      return (
        <div className="lp-faq__prose">
          <ol className="lp-faq__steps">
            <li>
              On a fresh deploy, create the first super-admin at{' '}
              <Link to="/bootstrap" className="lp-faq__link">
                /bootstrap
              </Link>{' '}
              (once)
            </li>
            <li>From Admin, invite a tenant owner and send the link securely</li>
            <li>
              Sign in to the{' '}
              <Link to={PRODUCT_LINKS.console} className="lp-faq__link">
                console
              </Link>
              , register an endpoint, then create an API key
            </li>
            <li>POST /v1/events with the key, then watch Deliveries</li>
          </ol>
          <p>
            <Link to={`${PRODUCT_LINKS.docs}/quick-start`} className="lp-faq__link">
              Quick start with curl
            </Link>
          </p>
        </div>
      )
    case 'signing':
      return (
        <div className="lp-faq__prose">
          <p>{item.a}</p>
          <p>
            <Link to={`${PRODUCT_LINKS.docs}#signing`} className="lp-faq__link">
              Signing recipe
            </Link>
          </p>
        </div>
      )
    case 'failures':
    case 'limits':
    case 'tenancy':
    case 'pricing':
      return <p>{item.a}</p>
    default: {
      const _exhaustive: never = item
      return _exhaustive
    }
  }
}

export function LandingFaq() {
  const [selectedId, setSelectedId] = useState<string>(FAQ_ITEMS[0].id)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  const selected = FAQ_ITEMS.find((item) => item.id === selectedId) ?? FAQ_ITEMS[0]
  const selectedIndex = FAQ_ITEMS.findIndex((item) => item.id === selected.id)

  function onSelect(id: string) {
    setSelectedId(id)
    if (!window.matchMedia('(max-width: 767px)').matches) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ block: 'nearest', behavior: motion ? 'auto' : 'smooth' })
    })
  }

  function moveTo(index: number) {
    const item = FAQ_ITEMS[index]
    if (!item) return
    tabRefs.current[index]?.focus()
    onSelect(item.id)
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = FAQ_ITEMS.length - 1
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        moveTo(index === last ? 0 : index + 1)
        return
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        moveTo(index === 0 ? last : index - 1)
        return
      case 'Home':
        event.preventDefault()
        moveTo(0)
        return
      case 'End':
        event.preventDefault()
        moveTo(last)
        return
      default:
        return
    }
  }

  return (
    <section id="faq" className="scroll-mt-(--nav-height) lp-faq" aria-labelledby="faq-heading">
      <LandingFrameInner className="lp-section lp-faq__inner">
        <header className="lp-split-heading">
          <h2 id="faq-heading">
            Questions before you <em>deploy</em>.
          </h2>
          <p>Setup, retries, signing, and tenancy — short answers.</p>
        </header>

        <div className="lp-faq__frame">
          <div className="lp-faq__board">
            <div className="lp-faq__nav" role="tablist" aria-label="Frequently asked questions">
              {FAQ_ITEMS.map((item, index) => {
                const selectedTab = item.id === selected.id
                return (
                  <button
                    key={item.id}
                    ref={(node) => {
                      tabRefs.current[index] = node
                    }}
                    type="button"
                    role="tab"
                    id={`faq-tab-${item.id}`}
                    className="lp-faq__tab"
                    aria-selected={selectedTab}
                    aria-controls="faq-panel"
                    tabIndex={selectedTab ? 0 : -1}
                    onClick={() => onSelect(item.id)}
                    onKeyDown={(event) => onTabKeyDown(event, index)}
                  >
                    <span className="lp-faq__index" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="lp-faq__question-text">{item.q}</span>
                  </button>
                )
              })}
            </div>

            <div
              ref={panelRef}
              id="faq-panel"
              className="lp-faq__panel"
              role="tabpanel"
              aria-labelledby={`faq-tab-${selected.id}`}
            >
              <p className="lp-faq__panel-index" aria-hidden="true">
                {String(selectedIndex + 1).padStart(2, '0')}
              </p>
              <h3 className="lp-faq__panel-title">{selected.q}</h3>
              <div className="lp-faq__answer">
                <FaqAnswerBody item={selected} />
              </div>
            </div>
          </div>

          <div className="lp-faq__footer">
            <p>Still something on your mind?</p>
            <Link to={PRODUCT_LINKS.docs} className="lp-text-link focus-ring">
              Read the docs <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </LandingFrameInner>
    </section>
  )
}
