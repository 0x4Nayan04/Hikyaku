import { API_BASE } from '@/api/client'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { DotPattern } from '@/components/ui/dot-pattern'
import { APP_NAME, PRODUCT_LINKS, PUBLIC_LINKS } from '@/lib/app-meta'
import { resolveGuestLandingPrimaryCta } from '@/lib/auth-first-run'
import { getDefaultHomePath, getHomeLabel } from '@/lib/auth-redirect'
import { loadBootstrapStatus, readBootstrapStatusCache } from '@/lib/bootstrap-status'
import { copyToClipboard } from '@/lib/clipboard'
import { buildIngestCurl } from '@/lib/tenant-onboarding'
import { useSession } from '@/providers/session-context'
import { ArrowRight, Check, Copy, LayoutDashboard } from 'lucide-react'
import { SiGithub } from 'react-icons/si'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const INGEST_EXAMPLE_KEY = 'whk_your_api_key'
const CURL_COPY = buildIngestCurl(INGEST_EXAMPLE_KEY, API_BASE)
const INGEST_URL = `${API_BASE}/v1/events`

export function LandingHero() {
  const navigate = useNavigate()
  const { session } = useSession()
  const [bootstrapAvailable, setBootstrapAvailable] = useState<boolean | null>(readBootstrapStatusCache)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (session) return
    let cancelled = false
    loadBootstrapStatus()
      .then((available) => {
        if (!cancelled) setBootstrapAvailable(available)
      })
      .catch(() => {
        if (!cancelled) setBootstrapAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  const guestPrimary = resolveGuestLandingPrimaryCta(bootstrapAvailable)
  const needsBootstrap = guestPrimary.path === '/bootstrap'

  async function handleCopy() {
    const ok = await copyToClipboard(CURL_COPY, 'cURL')
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section className="lp-hero" aria-labelledby="hero-heading">
      <DotPattern width={20} height={20} cr={1} className="lp-hero__pattern fill-primary/25" />
      <LandingFrameInner className="lp-hero__inner">
        <div className="lp-hero__center">
          <p className="lp-eyebrow">
            <span lang="ja" aria-hidden="true">
              飛脚
            </span>
            {APP_NAME}
          </p>
          <h1 id="hero-heading">
            Your webhooks, delivered. <em>Every time.</em>
          </h1>
          <p className="lp-hero__lead">
            Post an event once. {APP_NAME} fans it out to every endpoint: signed, retried, and recorded
            on infrastructure you run.
          </p>

          <div className="lp-hero__actions" role="group" aria-label="Get started">
            {session ? (
              <button
                type="button"
                onClick={() => navigate(getDefaultHomePath(session.user))}
                className="lp-button lp-button--primary focus-ring"
              >
                Go to {getHomeLabel(session.user).toLowerCase()}
                <LayoutDashboard className="size-4" aria-hidden="true" />
              </button>
            ) : (
              <>
                {needsBootstrap ? (
                  <Link to={guestPrimary.path} className="lp-button lp-button--primary focus-ring">
                    {guestPrimary.label}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <Link
                    to={`${PRODUCT_LINKS.docs}/quick-start`}
                    className="lp-button lp-button--primary focus-ring"
                  >
                    View quick start
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                )}
                <a
                  href={PUBLIC_LINKS.github}
                  className="lp-button lp-button--secondary focus-ring"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <SiGithub className="size-4" aria-hidden="true" />
                  View on GitHub
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </>
            )}
          </div>

          <figure className="lp-hero__command" aria-label="Example ingest request">
            <div className="lp-hero__command-head">
              <div className="lp-hero__command-meta">
                <span className="lp-hero__command-lang">bash</span>
                <span className="lp-hero__command-route" translate="no">
                  POST /v1/events
                </span>
              </div>
              <button
                type="button"
                className={`lp-cli-copy focus-ring${copied ? ' is-copied' : ''}`}
                onClick={() => void handleCopy()}
                aria-label={copied ? 'Copied ingest example' : 'Copy ingest example'}
              >
                {copied ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
                <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="lp-cli-block" translate="no">
              <code>
                <span className="lp-cli-k">curl</span> <span className="lp-cli-f">-X</span> POST{' '}
                <span className="lp-cli-p">&quot;{INGEST_URL}&quot;</span>
                {' \\\n  '}
                <span className="lp-cli-f">-H</span>{' '}
                <span className="lp-cli-s">
                  &quot;Authorization: Bearer {INGEST_EXAMPLE_KEY}&quot;
                </span>
                {' \\\n  '}
                <span className="lp-cli-f">-H</span>{' '}
                <span className="lp-cli-s">&quot;Content-Type: application/json&quot;</span>
                {' \\\n  '}
                <span className="lp-cli-f">-d</span>{' '}
                <span className="lp-cli-s">{`'{
    "idempotency_key": "order-123-paid",
    "type": "order.paid",
    "payload": { "order_id": "123", "amount": 4999 }
  }'`}</span>
              </code>
            </pre>
          </figure>
        </div>
      </LandingFrameInner>
    </section>
  )
}
