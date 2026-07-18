import { ArrowDownToLine, RadioTower, RotateCcw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'

type Step = {
  icon: LucideIcon
  title: string
  description: string
  number: string
}

const STEPS: Step[] = [
  {
    icon: ArrowDownToLine,
    title: 'Ingest the event',
    description: 'POST JSON to the ingest API. Hikyaku validates it and returns 202 Accepted.',
    number: '01',
  },
  {
    icon: RadioTower,
    title: 'Deliver per endpoint',
    description:
      'Each registered endpoint gets its own HMAC-signed HTTP request with the original payload.',
    number: '02',
  },
  {
    icon: RotateCcw,
    title: 'Retry and inspect',
    description:
      'Failed attempts retry with exponential backoff. Status, timing, and response body stay in the console.',
    number: '03',
  },
]

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="lp-flow" aria-labelledby="how-it-works-heading">
      <LandingFrameInner className="lp-section">
        <header className="lp-section-heading lp-section-heading--centered">
          <p className="lp-kicker">Ingest → deliver → retry</p>
          <h2 id="how-it-works-heading">How delivery works</h2>
          <p>
            One ingest API, per-endpoint signed deliveries, automatic retries, and attempt history
            in the console.
          </p>
        </header>

        <ol className="lp-steps">
          {STEPS.map((step) => (
            <li key={step.number}>
              <div className="lp-step__top">
                <span className="lp-step__icon">
                  <step.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="lp-step__number">{step.number}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </LandingFrameInner>
    </section>
  )
}
