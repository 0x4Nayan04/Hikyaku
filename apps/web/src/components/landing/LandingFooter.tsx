import type { SVGProps } from 'react'
import { ArrowUp, Zap } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { HikyakuMark } from '@/components/auth/HikyakuMark'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { APP_HOME_LABEL, APP_NAME, PRODUCT_LINKS, PUBLIC_LINKS } from '@/lib/app-meta'

function GitHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.46-1.15-1.11-1.46-1.11-1.46-.9-.62.07-.6.07-.6 1 .07 1.52 1.02 1.52 1.02.89 1.51 2.33 1.07 2.9.82.09-.64.35-1.08.63-1.33-2.22-.25-4.56-1.1-4.56-4.92 0-1.09.4-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.62 9.62 0 0 1 12 6.5c.85 0 1.7.11 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.83-2.34 4.66-4.57 4.91.36.3.68.87.68 1.75v2.6c0 .26.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  )
}

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.9 2H22l-6.77 7.73L23.2 22h-6.24l-4.89-7.4L5.6 22H2.48l7.24-8.27L2.08 2h6.4l4.42 6.72L18.9 2Zm-1.1 18h1.72L7.55 3.9H5.7L17.8 20Z" />
    </svg>
  )
}

const SOCIAL_LINKS = [
  { label: 'GitHub', href: PUBLIC_LINKS.github, icon: GitHubIcon },
  { label: 'X (Twitter)', href: PUBLIC_LINKS.social, icon: XIcon },
]

const FOOTER_GROUPS = [
  {
    label: 'Product',
    links: [
      { label: 'How it works', href: PRODUCT_LINKS.howItWorks },
      { label: 'Console', href: PRODUCT_LINKS.console },
      { label: 'FAQ', href: PRODUCT_LINKS.faq },
    ],
  },
  {
    label: 'Developers',
    links: [
      { label: 'Documentation', href: PRODUCT_LINKS.docs },
      { label: 'API reference', href: `${PRODUCT_LINKS.docs}/api-reference` },
    ],
  },
  {
    label: 'Account',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Request access', href: '/signup' },
    ],
  },
]

export function LandingFooter() {
  const year = new Date().getFullYear()
  const location = useLocation()

  const handleDocsClick = (event: React.MouseEvent) => {
    if (location.pathname === PRODUCT_LINKS.docs) {
      event.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <footer className="lp-footer">
      <LandingFrameInner className="lp-footer__inner">
        <div className="lp-final-cta">
          <div className="lp-final-cta__copy">
            <span className="lp-final-cta__icon" aria-hidden="true">
              <Zap className="size-5" fill="currentColor" fillOpacity={0.3} />
            </span>
            <div>
              <h2>Set up a tenant workspace</h2>
              <p>Request access, register endpoints, send a test event.</p>
            </div>
          </div>
          <div className="lp-final-cta__actions">
            <Link to="/signup" className="lp-button lp-button--light focus-ring">
              Request access →
            </Link>
            <Link
              to={PRODUCT_LINKS.docs}
              onClick={handleDocsClick}
              className="lp-button lp-button--on-dark focus-ring"
            >
              Read the docs
            </Link>
          </div>
        </div>

        <div className="lp-footer__grid">
          <div className="lp-footer__brand">
            <Link to={PRODUCT_LINKS.home} aria-label={APP_HOME_LABEL} className="focus-ring">
              <HikyakuMark className="size-8" />
              <strong>{APP_NAME}</strong>
            </Link>
            <p>HMAC-signed webhook delivery with automatic retries and attempt logs.</p>
            <div className="lp-footer__socials" aria-label="Hikyaku social links">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring"
                  aria-label={social.label}
                  title={social.label}
                >
                  <social.icon className="size-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <h3>{group.label}</h3>
              <ul>
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="focus-ring">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="lp-footer__bottom">
          <p>
            © {year} {APP_NAME}
          </p>
          <div>
            <a href={`${PRODUCT_LINKS.docs}/privacy`} className="focus-ring">
              Privacy
            </a>
            <span>Self-hosted webhook delivery.</span>
          </div>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
            className="focus-ring"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
        </div>
      </LandingFrameInner>
    </footer>
  )
}
