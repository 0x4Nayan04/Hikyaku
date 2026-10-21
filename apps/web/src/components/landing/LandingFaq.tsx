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
    a: 'Hikyaku retries with exponential backoff, up to five HTTP attempts. An HTTP attempt records status when the subscriber responds, timing, and up to 1 KB of body. Replay a failed delivery from the console or terminal once the endpoint is active again.',
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
    a: 'Each tenant has its own API keys, endpoints, events, and delivery history. Keys are hashed; endpoint secrets are shown once on create or rotate. Super-admins manage tenants from Admin.',
  },
  {
    id: 'pricing',
    q: 'Is there billing?',
    a: 'No. This is a self-hosted project with no paid plans. Admin invites each tenant owner. Per-tenant rate limits still apply.',
  },
  {
    id: 'known-limits',
    q: 'What should I know before production?',
    a: 'Endpoint signing secrets are stored so the worker can sign POSTs; they are not hashed like API keys. Rotation replaces the secret immediately — there is no dual-secret window. Invites and password resets are copy-paste links, with no email. Delivery is at-least-once; subscribers must dedupe on X-Webhook-Id.',
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
              Full workspace access is invite-only. There is no self-serve signup, and first-run
              setup is not available on this public site.
            </li>
            <li>
              To run a full console, clone the repo, start it locally, and create the installer
              account at <span translate="no">/bootstrap</span> on that install (once).
            </li>
            <li>
              From Admin, invite a tenant owner. Then use the{' '}
              <Link to={PRODUCT_LINKS.console} className="lp-faq__link">
                console
              </Link>{' '}
              or the terminal.
            </li>
          </ol>
          {import.meta.env.VITE_DEMO_LOGIN === 'true' ? (
            <p>
              To explore synthetic data without making changes, use the public credentials on{' '}
              <Link to={PRODUCT_LINKS.console} className="lp-faq__link">
                the read-only demo login
              </Link>
              .
            </p>
          ) : null}
          <p>
            Once you have an account, add endpoints, send events, and inspect or replay from the
            website or terminal.
          </p>
          <p>
            <Link to={`${PRODUCT_LINKS.docs}#console-path`} className="lp-faq__link">
              Website walkthrough
            </Link>
            {' · '}
            <Link to={`${PRODUCT_LINKS.docs}#api-only-path`} className="lp-faq__link">
              Terminal walkthrough
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
    case 'known-limits':
      return (
        <div className="lp-faq__prose">
          <p>{item.a}</p>
          <p>
            <Link to={`${PRODUCT_LINKS.docs}#known-limits`} className="lp-faq__link">
              Known limits
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
          <div className="lp-faq__list">
            {FAQ_ITEMS.map((item, index) => (
              <details key={item.id} className="lp-faq__item" name="lp-faq" open={index === 0}>
                <summary className="lp-faq__summary focus-ring">
                  <span className="lp-faq__index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="lp-faq__question-text">{item.q}</span>
                </summary>
                <div className="lp-faq__answer">
                  <FaqAnswerBody item={item} />
                </div>
              </details>
            ))}
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
