import { useState, useRef, useEffect } from 'react'
import { ChevronRight, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { PRODUCT_LINKS } from '@/lib/app-meta'
import { cn } from '@/lib/utils'

const FAQ_ITEMS = [
  {
    id: 'what-does',
    q: 'What does the platform do?',
    a: 'You ingest events once via the API, and we fan out signed deliveries to every registered endpoint — with retries, logging, and a console to operate it all.',
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
    a: 'Ingest and delivery throughput are capped per tenant to keep the shared platform stable. Limits are visible in Settings. For higher volume, contact your workspace admin.',
    category: 'Reliability',
  },
  {
    id: 'signing',
    q: 'How does HMAC signing work?',
    a: 'Each outbound delivery includes an X-Webhook-Signature header derived from the endpoint secret and request body. Receivers recompute the digest to verify authenticity.',
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
    a: 'Events, deliveries, and attempt logs are retained for operator debugging and replay. Retention windows depend on your deployment configuration.',
    category: 'Security',
  },
  {
    id: 'pricing',
    q: 'How much does it cost?',
    a: 'Self-serve signup is free to get started. Create a workspace, register endpoints, and send test events without a sales call. Usage limits apply per workspace.',
    category: 'Pricing',
  },
  {
    id: 'multi-tenant',
    q: 'Is it multi-tenant?',
    a: 'Yes. Each tenant has isolated API keys, endpoints, events, and delivery history. Super-admins manage tenants and approve signups from the admin panel.',
    category: 'Pricing',
  },
]

const CATEGORIES = ['All', 'Getting started', 'Reliability', 'Security', 'Pricing']

const CATEGORY_ITEM_COUNTS: Record<string, number> = {}
for (const item of FAQ_ITEMS) {
  CATEGORY_ITEM_COUNTS[item.category] = (CATEGORY_ITEM_COUNTS[item.category] ?? 0) + 1
}

function FaqAnswerBody({ item }: { item: (typeof FAQ_ITEMS)[number] }) {
  if (item.id === 'get-started') {
    return (
      <div className="faq-answer-prose">
        <p className="faq-answer-step">
          <span className="faq-answer-step-num">1.</span>
          <span>Create an account and verify your email</span>
        </p>
        <p className="faq-answer-step">
          <span className="faq-answer-step-num">2.</span>
          <span>
            Register your first endpoint in the{' '}
            <Link to={PRODUCT_LINKS.console} className="faq-answer-link">
              console
            </Link>
          </span>
        </p>
        <p className="faq-answer-step">
          <span className="faq-answer-step-num">3.</span>
          <span>Generate an API key in Settings</span>
        </p>
        <p className="faq-answer-step">
          <span className="faq-answer-step-num">4.</span>
          <span>Send a test event from the Send event page</span>
        </p>
        <p className="mt-3 text-sm text-muted">
          See{' '}
          <a href={PRODUCT_LINKS.docs} className="faq-answer-link">
            curl examples and setup guide
          </a>
        </p>
      </div>
    )
  }

  if (item.id === 'failures') {
    return (
      <ul className="faq-answer-list">
        <li>Automatic retries with exponential backoff — no manual intervention needed</li>
        <li>Every attempt recorded: HTTP status, timing, and response body</li>
        <li>Inspect full delivery history from the console — filter by endpoint or status</li>
        <li>Replay failed deliveries with one click once the endpoint recovers</li>
      </ul>
    )
  }

  if (item.id === 'privacy') {
    return (
      <ul className="faq-answer-list">
        <li>Tenant data is fully isolated by workspace — no cross-tenant access</li>
        <li>API keys are stored hashed; endpoint secrets shown once at creation</li>
        <li>Session cookies power the operator console — no secrets in browser storage</li>
        <li>All deliveries use HTTPS; payloads encrypted in transit and at rest</li>
      </ul>
    )
  }

  return <p className="faq-answer-text">{item.a}</p>
}

export function LandingFaq() {
  const [selectedId, setSelectedId] = useState('what-does')
  const [activeCategory, setActiveCategory] = useState('All')
  const answerRef = useRef<HTMLDivElement>(null)

  const filtered =
    activeCategory === 'All'
      ? FAQ_ITEMS
      : FAQ_ITEMS.filter((i) => i.category === activeCategory)

  useEffect(() => {
    const items =
      activeCategory === 'All'
        ? FAQ_ITEMS
        : FAQ_ITEMS.filter((i) => i.category === activeCategory)
    if (items.length > 0 && !items.some((i) => i.id === selectedId)) {
      setSelectedId(items[0].id)
    }
  }, [activeCategory, selectedId])

  const selected = FAQ_ITEMS.find((i) => i.id === selectedId) ?? FAQ_ITEMS[0]

  const handleSelect = (id: string) => {
    setSelectedId(id)
    if (window.innerWidth < 1024 && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <section
      id="faq"
      className="scroll-mt-[calc(var(--nav-height)+var(--section-bar-height))] faq-section"
      aria-labelledby="faq-heading"
    >
      <LandingFrameInner className="faq-container">
        <header className="faq-header">
          <p className="landing-section-kicker">Support</p>
          <h2 id="faq-heading" className="landing-section-title text-ink">
            Frequently asked questions
          </h2>
        </header>

        <div className="faq-filters">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={cn('faq-filter', activeCategory === cat && 'faq-filter--active')}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
              {cat !== 'All' && (
                <span className="faq-filter-count">{CATEGORY_ITEM_COUNTS[cat]}</span>
              )}
            </button>
          ))}
        </div>

        <div className="faq-split">
          <div className="faq-question-list" role="tablist" aria-label="Questions">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selectedId === item.id}
                className={cn(
                  'faq-question-row',
                  selectedId === item.id && 'faq-question-row--active',
                )}
                onClick={() => handleSelect(item.id)}
              >
                <div className="faq-question-row-body">
                  <span className="faq-question-row-text">{item.q}</span>
                  <span className="faq-question-row-cat">{item.category}</span>
                </div>
                <ChevronRight
                  className={cn(
                    'faq-question-row-arrow',
                    selectedId === item.id && 'faq-question-row-arrow--active',
                  )}
                />
              </button>
            ))}
          </div>

          <div className="faq-answer-panel" ref={answerRef} aria-live="polite">
            <div className="faq-answer-card" key={selected.id}>
              <h3 className="faq-answer-heading">{selected.q}</h3>
              <div className="faq-answer-body">
                <FaqAnswerBody item={selected} />
              </div>
              <div className="faq-answer-docs">
                <a href={PRODUCT_LINKS.docs} className="faq-answer-docs-link">
                  Read the docs <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>

      </LandingFrameInner>
    </section>
  )
}
