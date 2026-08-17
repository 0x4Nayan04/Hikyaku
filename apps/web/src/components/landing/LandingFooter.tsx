import { HikyakuMark } from '@/components/auth/HikyakuMark'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { DotPattern } from '@/components/ui/dot-pattern'
import { APP_HOME_LABEL, APP_NAME, PRODUCT_LINKS, PUBLIC_LINKS } from '@/lib/app-meta'
import { ArrowUpRight } from 'lucide-react'
import type { MouseEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'

type FooterLink = {
  label: string
  href: string
  external?: boolean
}

const FOOTER_GROUPS: { label: string; links: FooterLink[] }[] = [
  {
    label: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: `Why ${APP_NAME}`, href: PRODUCT_LINKS.whyHaiku },
      { label: 'FAQ', href: PRODUCT_LINKS.faq },
    ],
  },
  {
    label: 'Developers',
    links: [
      { label: 'Quick start', href: `${PRODUCT_LINKS.docs}/quick-start` },
      { label: 'Documentation', href: PRODUCT_LINKS.docs },
      { label: 'API reference', href: `${PRODUCT_LINKS.docs}#api-reference` },
    ],
  },
  {
    label: 'Connect',
    links: [
      { label: 'GitHub', href: PUBLIC_LINKS.github, external: true },
      { label: 'Issues', href: `${PUBLIC_LINKS.github}/issues`, external: true },
      { label: 'X', href: PUBLIC_LINKS.social, external: true },
    ],
  },
]

function FooterNavLink({
  link,
  onDocsClick,
}: {
  link: FooterLink
  onDocsClick: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  const className = 'lp-footer__link focus-ring'

  if (link.external) {
    return (
      <a href={link.href} className={className} target="_blank" rel="noopener noreferrer">
        {link.label}
        <ArrowUpRight className="lp-footer__glyph" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    )
  }

  return (
    <Link
      to={link.href}
      className={className}
      onClick={link.href.startsWith(PRODUCT_LINKS.docs) ? onDocsClick : undefined}
    >
      {link.label}
    </Link>
  )
}

export function LandingFooter() {
  const year = new Date().getFullYear()
  const location = useLocation()

  const handleDocsClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname !== PRODUCT_LINKS.docs) return
    const url = new URL(event.currentTarget.href, window.location.origin)
    if (url.pathname !== PRODUCT_LINKS.docs) return
    event.preventDefault()
    if (url.hash) {
      document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="lp-footer">
      <DotPattern width={20} height={20} cr={1} className="lp-footer__pattern fill-white/18" />
      <LandingFrameInner className="lp-footer__inner">
        <div className="lp-footer__top">
          <div className="lp-footer__brand">
            <Link
              to={PRODUCT_LINKS.home}
              aria-label={APP_HOME_LABEL}
              className="lp-footer__identity focus-ring"
            >
              <HikyakuMark decorative className="lp-footer__mark size-9" />
              <span className="lp-footer__name">
                <strong>{APP_NAME}</strong>
                <em lang="ja" aria-hidden="true">
                  飛脚
                </em>
              </span>
            </Link>
            <p>Reliable, self-hosted webhook delivery.</p>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <h3>{group.label}</h3>
              <ul>
                {group.links.map((link) => (
                  <li key={link.label}>
                    <FooterNavLink link={link} onDocsClick={handleDocsClick} />
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
          <div className="lp-footer__legal">
            <Link to="/login" className="lp-footer__link lp-footer__link--quiet focus-ring">
              Sign in
            </Link>
            <Link
              to={`${PRODUCT_LINKS.docs}#privacy`}
              className="lp-footer__link lp-footer__link--quiet focus-ring"
              onClick={handleDocsClick}
            >
              Privacy
            </Link>
          </div>
        </div>
      </LandingFrameInner>
    </footer>
  )
}
