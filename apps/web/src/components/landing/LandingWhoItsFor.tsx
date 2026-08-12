import { KeyRound, Server, Terminal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'

type Point = {
  icon: LucideIcon
  title: string
  description: string
  number: string
}

const POINTS: Point[] = [
  {
    icon: Server,
    title: 'You run the stack',
    description:
      'Deploy the API, worker, and console with Postgres and Redis. No hosted SaaS — your infra, your data.',
    number: '01',
  },
  {
    icon: Terminal,
    title: 'Producers ingest events',
    description:
      'Your backends POST JSON with a tenant API key. Hikyaku fans out one signed delivery per active endpoint.',
    number: '02',
  },
  {
    icon: KeyRound,
    title: 'Operators use the console',
    description:
      'Invite tenants, register endpoints, inspect attempts, and replay failures when a subscriber is down.',
    number: '03',
  },
]

export function LandingWhoItsFor() {
  return (
    <section id="who-its-for" className="lp-flow lp-who" aria-labelledby="who-its-for-heading">
      <LandingFrameInner className="lp-section">
        <header className="lp-section-heading lp-section-heading--centered">
          <p className="lp-kicker">Self-hosted</p>
          <h2 id="who-its-for-heading">Who this is for</h2>
          <p>
            Teams that want webhook delivery infrastructure they control — not a cloud signup
            product.
          </p>
        </header>

        <ol className="lp-steps">
          {POINTS.map((point) => (
            <li key={point.number}>
              <div className="lp-step__top">
                <span className="lp-step__icon">
                  <point.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="lp-step__number">{point.number}</span>
              </div>
              <h3>{point.title}</h3>
              <p>{point.description}</p>
            </li>
          ))}
        </ol>
      </LandingFrameInner>
    </section>
  )
}
