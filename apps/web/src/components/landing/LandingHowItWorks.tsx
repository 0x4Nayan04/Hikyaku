import { Inbox, Send, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'

type Step = {
  icon: LucideIcon
  title: string
  description: string
  detail: string
  number: string
}

const STEPS: Step[] = [
  {
    icon: Inbox,
    title: 'Ingest',
    description: 'POST event → single endpoint',
    detail: 'Send a JSON payload with your tenant API key. We validate, enqueue, and prepare fan-out.',
    number: '01',
  },
  {
    icon: ShieldCheck,
    title: 'Sign',
    description: 'HMAC attached to every delivery',
    detail: 'Each outbound request includes an X-Webhook-Signature header. Receivers verify authenticity without a signing service.',
    number: '02',
  },
  {
    icon: Send,
    title: 'Deliver',
    description: 'Fan out with retries + logging',
    detail: 'Payloads are delivered to every registered endpoint. Failures retry automatically with exponential backoff — every attempt logged.',
    number: '03',
  },
]

export function LandingHowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-[calc(var(--nav-height)+var(--section-bar-height))] border-t border-border bg-surface"
      aria-labelledby="how-it-works-heading"
    >
      <LandingFrameInner className="landing-section-intro">
        <p className="landing-section-kicker">Workflow</p>
        <h2 id="how-it-works-heading" className="landing-section-title text-ink">
          How it works
        </h2>
        <p className="landing-section-lead max-w-xl">
          From a single API call to verified delivery at every endpoint.
        </p>
      </LandingFrameInner>

      <LandingFrameInner className="pb-[var(--section-pad-y)]">
        <ol
          className="grid gap-3 sm:grid-cols-3 m-0 list-none p-0"
          aria-label="How webhook delivery works"
        >
          {STEPS.map((step) => (
            <li
              key={step.title}
              className="relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-lg border border-border bg-background-alt">
                  <step.icon className="size-5 text-primary" strokeWidth={1.6} />
                </span>
                <span className="font-mono text-xs font-medium tracking-wider text-muted-strong">
                  Step {step.number}
                </span>
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-strong">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </LandingFrameInner>
    </section>
  )
}
