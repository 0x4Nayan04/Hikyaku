import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { PRODUCT_LINKS, PUBLIC_LINKS } from '@/lib/meta/app-meta'
import { ArrowRight } from 'lucide-react'
import { GithubIcon } from '@/components/icons/GithubIcon'
import { Link } from 'react-router-dom'

export function LandingFinalCta() {
  return (
    <section className="lp-final" aria-labelledby="final-cta-heading">
      <LandingFrameInner className="lp-section lp-final__inner">
        <h2 id="final-cta-heading">
          Deploy the courier. Send your <em>first event</em>.
        </h2>
        <p>
          Clone the repo, bring up Postgres and Redis, and follow the quick start. Sign in after you
          bootstrap or accept an invite.
        </p>
        <div className="lp-final__actions" role="group" aria-label="Quick start">
          <Link
            to={`${PRODUCT_LINKS.docs}/quick-start`}
            className="lp-button lp-button--primary focus-ring"
          >
            View quick start
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <a
            href={PUBLIC_LINKS.github}
            className="lp-button lp-button--secondary focus-ring"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GithubIcon className="size-4" aria-hidden="true" />
            View on GitHub
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </LandingFrameInner>
    </section>
  )
}
