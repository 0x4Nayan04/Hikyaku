import { useState } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'
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

const CATEGORIES = ['Getting started', 'Reliability', 'Security', 'Pricing']

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
  const [activeCategory, setActiveCategory] = useState('Getting started')

  const filtered = FAQ_ITEMS.filter((item) => item.category === activeCategory)

  const handleSelect = (id: string) => {
    setSelectedId((current) => (current === id ? '' : id))
  }

  const handleCategorySelect = (category: string) => {
    setActiveCategory(category)
    setSelectedId(FAQ_ITEMS.find((item) => item.category === category)?.id ?? '')
  }

  return (
    <section
      id="faq"
      className="scroll-mt-[calc(var(--nav-height)+var(--section-bar-height))] faq-section"
      aria-labelledby="faq-heading"
    >
      <LandingFrameInner className="faq-container">
        <div className="faq-intro">
          <header className="faq-header">
            <p className="landing-section-kicker">Support</p>
            <h2 id="faq-heading" className="landing-section-title text-ink">
              Questions, answered.
            </h2>
            <p className="faq-lead">
              The essentials for setting up, securing, and operating your webhook delivery
              workflow.
            </p>
          </header>
          <a href={PRODUCT_LINKS.docs} className="faq-docs-link">
            Explore documentation <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>

        <div className="faq-content">
          <div className="faq-filters" role="tablist" aria-label="FAQ topics">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={activeCategory === category}
                className={cn(
                  'faq-filter',
                  activeCategory === category && 'faq-filter--active',
                )}
                onClick={() => handleCategorySelect(category)}
              >
                {category}
                <span className="faq-filter-count">{CATEGORY_ITEM_COUNTS[category]}</span>
              </button>
            ))}
          </div>

          <div className="faq-question-list">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={cn('faq-item', selectedId === item.id && 'faq-item--open')}
              >
                <button
                  type="button"
                  className="faq-question-row"
                  aria-expanded={selectedId === item.id}
                  aria-controls={`faq-answer-${item.id}`}
                  onClick={() => handleSelect(item.id)}
                >
                  <span className="faq-question-row-text">{item.q}</span>
                  <ChevronDown className="faq-question-row-arrow" aria-hidden="true" />
                </button>
                {selectedId === item.id && (
                  <div id={`faq-answer-${item.id}`} className="faq-answer" role="region">
                    <FaqAnswerBody item={item} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </LandingFrameInner>
    </section>
  )
}
