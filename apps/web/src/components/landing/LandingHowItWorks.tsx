import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { LandingFanout } from '@/components/landing/LandingFanout'

const STEPS = [
  {
    number: '01',
    title: 'Accept',
    description:
      'POST JSON once. Hikyaku validates the event, returns 202, and owns the fan-out from there.',
  },
  {
    number: '02',
    title: 'Deliver',
    description:
      'Each active endpoint gets its own HMAC-signed HTTP request with the original payload.',
  },
  {
    number: '03',
    title: 'Recover',
    description:
      'Failures back off automatically. Status, timing, and body stay in the ledger for replay.',
  },
] as const

export function LandingHowItWorks() {
  return (
    <section
      id="how-it-works"
      className="lp-flow scroll-mt-(--nav-height)"
      aria-labelledby="how-it-works-heading"
    >
      <LandingFrameInner className="lp-section">
        <header className="lp-split-heading">
          <h2 id="how-it-works-heading">
            Ingest once. Fan out with a <em>ledger.</em>
          </h2>
          <p>Signed deliveries, automatic retries, and attempt history you can inspect.</p>
        </header>

        <ol className="lp-steps">
          {STEPS.map((step) => (
            <li key={step.number} className={`lp-step lp-step--${step.number}`}>
              <span className="lp-step__number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>

        <div className="lp-flow__stage" aria-label="Webhook delivery example">
          <div className="lp-flow__stage-bar">
            <span>Accept → deliver → recover</span>
          </div>
          <LandingFanout />
        </div>
      </LandingFrameInner>
    </section>
  )
}
