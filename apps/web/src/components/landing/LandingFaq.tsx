import { useState } from 'react'
import { ArrowUpRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { APP_NAME, PRODUCT_LINKS } from '@/lib/app-meta'
import { cn } from '@/lib/utils'

const FAQ_ITEMS = [
  {
    id: 'what-does',
    q: `What does ${APP_NAME} do?`,
    a: `${APP_NAME} accepts an event over the API, fans it out as HMAC-signed HTTP deliveries to your endpoints, retries failures with exponential backoff, and keeps attempt history in the console.`,
    category: 'Getting started',
  },
  {
    id: 'get-started',
    q: 'How do I get started?',
    a: null,
    category: 'Getting started',
  },
  {
    id: 'failures',
    q: 'How do you handle failures?',
    a: null,
    category: 'Reliability',
  },
  {
    id: 'limits',
    q: 'Are there rate limits?',
    a: 'Yes. Ingest and delivery are rate-limited per tenant. Limits come from the deployment configuration.',
    category: 'Reliability',
  },
  {
    id: 'signing',
    q: 'How does HMAC signing work?',
    a: 'Each delivery includes an X-Webhook-Signature header computed from the endpoint secret and request body. Receivers recompute the digest to verify the payload.',
    category: 'Security',
  },
  {
    id: 'privacy',
    q: 'How is my data handled?',
    a: null,
    category: 'Security',
  },
  {
    id: 'data-retention',
    q: 'How long is event data kept?',
    a: 'Events, deliveries, and attempt logs stay in the database for debugging and replay. Retention depends on how you configure the deployment.',
    category: 'Security',
  },
  {
    id: 'pricing',
    q: 'Is there billing?',
    a: 'No. This is a self-hosted project with no paid plans. Signup creates an access request that a platform admin must approve. Per-tenant rate limits still apply.',
    category: 'Access',
  },
  {
    id: 'multi-tenant',
    q: 'Is it multi-tenant?',
    a: 'Yes. Each tenant has its own API keys, endpoints, events, and delivery history. Super-admins manage tenants from the admin panel.',
    category: 'Access',
  },
]

const CATEGORIES = ['Getting started', 'Reliability', 'Security', 'Access'] as const

function FaqAnswerBody({ item }: { item: (typeof FAQ_ITEMS)[number] }) {
  if (item.id === 'get-started') {
    return (
      <div className="lp-faq__prose">
        <ol className="lp-faq__steps">
          <li>Create a signup request and wait for admin approval</li>
          <li>
            Register an endpoint in the{' '}
            <Link to={PRODUCT_LINKS.console} className="lp-faq__link">
              console
            </Link>
          </li>
          <li>Generate an API key in Settings</li>
          <li>Send a test event from the Send event page</li>
        </ol>
        <p>
          See{' '}
          <Link to={PRODUCT_LINKS.docs} className="lp-faq__link">
            curl examples and setup guide
          </Link>
        </p>
      </div>
    )
  }

  if (item.id === 'failures') {
    return (
      <ul className="lp-faq__bullets">
        <li>Automatic retries with exponential backoff (up to five HTTP attempts)</li>
        <li>Each attempt records status, timing, and response body</li>
        <li>Filter delivery history by endpoint or status in the console</li>
        <li>Replay a failed delivery after the endpoint recovers</li>
      </ul>
    )
  }

  if (item.id === 'privacy') {
    return (
      <ul className="lp-faq__bullets">
        <li>Tenant data is isolated by workspace</li>
        <li>API keys are hashed; endpoint secrets are shown once at creation</li>
        <li>The console uses session cookies — secrets are not stored in browser storage</li>
        <li>Outbound deliveries use the endpoint URL you register (HTTPS recommended)</li>
      </ul>
    )
  }

  return <p>{item.a}</p>
}

export function LandingFaq() {
  const [selectedId, setSelectedId] = useState('what-does')
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>('Getting started')

  const filtered = FAQ_ITEMS.filter((item) => item.category === activeCategory)

  const handleSelect = (id: string) => {
    setSelectedId((current) => (current === id ? '' : id))
  }

  const handleCategorySelect = (category: (typeof CATEGORIES)[number]) => {
    setActiveCategory(category)
    setSelectedId(FAQ_ITEMS.find((item) => item.category === category)?.id ?? '')
  }

  return (
    <section
      id="faq"
      className="scroll-mt-[calc(var(--nav-height)+var(--section-bar-height))] lp-faq"
      aria-labelledby="faq-heading"
    >
      <LandingFrameInner className="lp-section lp-faq__inner">
        <header className="lp-section-heading lp-section-heading--centered">
          <p className="lp-kicker">FAQ</p>
          <h2 id="faq-heading">Common questions</h2>
          <p>Setup, security, and operations for {APP_NAME} webhook delivery.</p>
        </header>

        <div className="lp-faq__tabs" role="tablist" aria-label="FAQ topics">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={activeCategory === category}
              className={cn(
                'lp-faq__tab',
                activeCategory === category && 'lp-faq__tab--active',
              )}
              onClick={() => handleCategorySelect(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="lp-faq__list" key={activeCategory}>
          {filtered.map((item, index) => {
            const open = selectedId === item.id
            return (
              <div
                key={item.id}
                className={cn('lp-faq__item', open && 'lp-faq__item--open')}
              >
                <button
                  type="button"
                  className="lp-faq__question"
                  aria-expanded={open}
                  aria-controls={`faq-answer-${item.id}`}
                  onClick={() => handleSelect(item.id)}
                >
                  <span className="lp-faq__index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="lp-faq__question-text">{item.q}</span>
                  <span className="lp-faq__toggle" aria-hidden="true">
                    <Plus className="size-4" />
                  </span>
                </button>
                {open && (
                  <div id={`faq-answer-${item.id}`} className="lp-faq__answer" role="region">
                    <FaqAnswerBody item={item} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="lp-faq__footer">
          <Link to={PRODUCT_LINKS.docs} className="lp-text-link focus-ring">
            Full documentation <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </LandingFrameInner>
    </section>
  )
}
