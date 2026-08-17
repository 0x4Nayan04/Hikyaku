import '@fontsource/instrument-serif/latin-400-italic.css'
import { LandingFrame } from '@/components/landing/LandingFrame'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingNavbar } from '@/components/landing/LandingNavbar'
import { DotPattern } from '@/components/ui/dot-pattern'
import { APP_NAME, PRODUCT_LINKS } from '@/lib/app-meta'
import { getDefaultHomePath, getHomeLabel } from '@/lib/auth-redirect'
import { useSession } from '@/providers/session-context'
import '@/styles/domains/chrome.css'
import '@/styles/domains/landing-revamp.css'
import { ArrowRight, LayoutDashboard } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const GLYPHS = [
  {
    kanji: '飛',
    reading: 'tobi',
    title: 'To fly',
    body: 'The distance the message has to cross.',
  },
  {
    kanji: '脚',
    reading: 'kyaku',
    title: 'The runner',
    body: 'Someone has to carry it — and arrive.',
  },
] as const

const MAPPING = [
  {
    number: '01',
    title: 'Sealed letter → signed event',
    description: 'A hikyaku carried a sealed dispatch. Each delivery is HMAC-signed so the subscriber can trust it.',
  },
  {
    number: '02',
    title: 'Closed gate → retry',
    description: 'If the door was shut, the courier tried again. Transient failures back off and return.',
  },
  {
    number: '03',
    title: 'Arrival record → ledger',
    description: 'Receipt was the point. Status, timing, and body stay inspectable after the run.',
  },
] as const

export function Name() {
  const navigate = useNavigate()
  const { session } = useSession()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    const frame = requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="landing-page flex min-h-screen flex-col">
      <LandingFrame>
        <LandingNavbar />
        <main id="main-content" className="flex-1">
          <section className="lp-hero lp-hero--name" aria-labelledby="name-heading">
            <DotPattern width={20} height={20} cr={1} className="lp-hero__pattern fill-primary/25" />
            <LandingFrameInner className="lp-hero__inner">
              <div className="lp-hero__grid">
                <div className="lp-hero__content">
                  <p className="lp-eyebrow">
                    <span aria-hidden="true">飛脚</span>
                    hikyaku
                  </p>
                  <h1 id="name-heading">
                    Why we named it <em>{APP_NAME}</em>
                  </h1>
                  <p className="lp-hero__lead">
                    Japan’s historic express couriers. The characters name the job: fly the
                    distance, run it to the door.
                  </p>
                  <div className="lp-hero__actions" role="group" aria-label="Continue">
                    <Link to={PRODUCT_LINKS.home} className="lp-button lp-button--primary focus-ring">
                      Back home
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                    {session ? (
                      <button
                        type="button"
                        onClick={() => navigate(getDefaultHomePath(session.user))}
                        className="lp-button lp-button--secondary focus-ring"
                      >
                        Go to {getHomeLabel(session.user).toLowerCase()}
                        <LayoutDashboard className="size-4" aria-hidden="true" />
                      </button>
                    ) : (
                      <Link to={PRODUCT_LINKS.docs} className="lp-button lp-button--secondary focus-ring">
                        Read the docs
                      </Link>
                    )}
                  </div>
                </div>

                <div className="lp-hero__stage lp-hero__stage--glyphs" aria-label="Meaning of 飛脚">
                  <div className="lp-hero__stage-bar">
                    <span className="lp-hero__stage-brand" lang="ja">
                      飛脚
                    </span>
                    <span className="lp-hero__stage-status">hi · kya · ku</span>
                  </div>
                  <ul className="lp-name-glyphs">
                    {GLYPHS.map((glyph) => (
                      <li key={glyph.kanji}>
                        <p className="lp-name-glyphs__kanji" lang="ja">
                          {glyph.kanji}
                        </p>
                        <p className="lp-name-glyphs__meta">
                          <span className="lp-name-glyphs__reading">{glyph.reading}</span>
                          <span aria-hidden="true"> · </span>
                          {glyph.title}
                        </p>
                        <p>{glyph.body}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </LandingFrameInner>
          </section>

          <section className="lp-flow" aria-labelledby="name-map-heading">
            <LandingFrameInner className="lp-section">
              <header className="lp-split-heading">
                <h2 id="name-map-heading">
                  Then a courier. <em>Now a webhook.</em>
                </h2>
                <p>
                  Same errand: take the word, cross the gap, arrive, leave a record. That is the
                  work this platform does — so that is the name it carries.
                </p>
              </header>
              <ol className="lp-steps">
                {MAPPING.map((item) => (
                  <li key={item.number} className={`lp-step lp-step--${item.number}`}>
                    <span className="lp-step__number">{item.number}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </li>
                ))}
              </ol>
            </LandingFrameInner>
          </section>
        </main>
        <div className="site-footer-block">
          <LandingFooter />
        </div>
      </LandingFrame>
    </div>
  )
}
