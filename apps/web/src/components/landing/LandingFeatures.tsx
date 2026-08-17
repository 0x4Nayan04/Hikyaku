import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { History, RotateCcw, Server, ShieldCheck, Split, Users } from 'lucide-react'
import type { ComponentType } from 'react'

type Feature = {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: Split,
    title: 'Fan-out delivery',
    description:
      'POST one event to Hikyaku and it creates a separate delivery for every active endpoint on your tenant — no fan-out logic to write yourself.',
  },
  {
    icon: ShieldCheck,
    title: 'HMAC-signed requests',
    description:
      'Every outbound request carries X-Webhook-Timestamp and X-Webhook-Signature, an HMAC-SHA256 of the raw body. Subscribers verify before trusting a payload.',
  },
  {
    icon: RotateCcw,
    title: 'Automatic retries',
    description:
      'Failed or timed-out deliveries back off exponentially for up to five attempts. A background sweeper recovers deliveries stuck after a worker crash.',
  },
  {
    icon: History,
    title: 'Full attempt history',
    description:
      'Status, timing, and response body are recorded for every attempt. Inspect any delivery in the console and replay it with one click.',
  },
  {
    icon: Users,
    title: 'Multi-tenant isolation',
    description:
      'Each tenant gets its own API keys, endpoints, events, and delivery history. Keys are hashed at rest; endpoint secrets are shown once.',
  },
  {
    icon: Server,
    title: 'Self-hosted, no lock-in',
    description:
      'Runs on your own Postgres and Redis. No hosted plan, no billing, no third party holding your webhook traffic.',
  },
]

export function LandingFeatures() {
  return (
    <section id="features" className="lp-features scroll-mt-(--nav-height)" aria-labelledby="features-heading">
      <LandingFrameInner className="lp-section">
        <header className="lp-split-heading">
          <h2 id="features-heading">
            Everything webhook delivery <em>needs</em>, built in.
          </h2>
          <p>The parts you'd otherwise rebuild for every integration, done once.</p>
        </header>

        <ul className="lp-feature-grid">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="lp-feature-card">
              <feature.icon className="lp-feature-card__icon" aria-hidden="true" />
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </li>
          ))}
        </ul>
      </LandingFrameInner>
    </section>
  )
}
