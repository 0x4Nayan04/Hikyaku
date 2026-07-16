import { ArrowUp, Zap } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { WebhookMark } from '@/components/auth/WebhookMark'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { Button } from '@/components/ui/button'
import { PRODUCT_LINKS, PUBLIC_LINKS } from '@/lib/app-meta'

const GITHUB_URL = 'https://github.com/0x4Nayan04'
const TWITTER_URL = 'https://x.com/NayanSwarnkar04'

const PRODUCT_GROUP = [
  { label: 'How it works', href: PRODUCT_LINKS.howItWorks },
  { label: 'Console', href: PRODUCT_LINKS.console },
  { label: 'Docs', href: PRODUCT_LINKS.docs },
  { label: 'FAQ', href: PRODUCT_LINKS.faq },
]

const DEVELOPERS_GROUP = [
  { label: 'API Reference', href: `${PRODUCT_LINKS.docs}#api-reference` },
  { label: 'Developer Guides', href: PRODUCT_LINKS.docs },
]

const COMMUNITY_GROUP = [
  { label: 'GitHub', href: PUBLIC_LINKS.github ?? GITHUB_URL, external: true, icon: GithubIcon },
  { label: 'X (Twitter)', href: TWITTER_URL, external: true, icon: XIcon },
]

const ACCOUNT_GROUP = [
  { label: 'Sign in', to: '/login' },
  { label: 'Sign up', to: '/signup' },
]

const LEGAL_LINKS = [
  { label: 'Privacy', href: `${PRODUCT_LINKS.docs}#privacy` },
  { label: 'Terms', href: PRODUCT_LINKS.faq },
]

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function LandingFooter() {
  const year = new Date().getFullYear()
  const location = useLocation()

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDocsClick = (e: React.MouseEvent) => {
    if (location.pathname === PRODUCT_LINKS.docs) {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <footer className="landing-footer">
      <LandingFrameInner className="landing-footer-wrap">
        <div className="relative mb-12 lg:mb-16 overflow-hidden rounded-xl bg-primary border border-primary px-6 py-8 md:py-10 md:px-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay" 
               style={{ backgroundImage: 'radial-gradient(circle at center, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-4 text-center md:text-left">
            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/15 border border-white/20 shadow-sm flex items-center justify-center">
              <Zap className="size-5 text-white" fill="currentColor" fillOpacity={0.3} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-display font-medium tracking-tight text-white mb-1">
                Ready to ship webhooks reliably?
              </h2>
              <p className="text-sm md:text-[15px] text-white/80 max-w-md">
                One API call. Signed delivery to every endpoint.
              </p>
            </div>
          </div>
          
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Button asChild size="default" className="w-full sm:w-auto text-sm bg-white text-primary hover:bg-white/90">
              <Link to="/signup">Get started free &rarr;</Link>
            </Button>
            <Button asChild variant="outline" size="default" className="w-full sm:w-auto text-sm bg-white text-primary hover:bg-white/90">
              <Link to={PRODUCT_LINKS.docs} onClick={handleDocsClick}>Read the docs</Link>
            </Button>
          </div>
        </div>

        <div className="landing-footer-grid">
          <div className="landing-footer-brand-col">
            <Link
              to={PRODUCT_LINKS.home}
              className="landing-footer-brand focus-ring"
              aria-label="Webhook Delivery — home"
            >
              <WebhookMark className="size-5 shrink-0 text-primary" />
              <span className="landing-footer-brand-text">Webhook Delivery</span>
            </Link>
            <p className="landing-footer-tagline">
              Ingest once. Deliver everywhere. Signed, retried, and monitored.
            </p>
            <Link to="/signup" className="landing-footer-cta focus-ring">
              Get started free &rarr;
            </Link>
          </div>

          <div className="landing-footer-group">
            <h3 className="landing-footer-group-label">Product</h3>
            <ul className="landing-footer-group-list">
              {PRODUCT_GROUP.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="landing-footer-link focus-ring">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="landing-footer-group">
            <h3 className="landing-footer-group-label">Developers</h3>
            <ul className="landing-footer-group-list">
              {DEVELOPERS_GROUP.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="landing-footer-link focus-ring"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="landing-footer-group">
            <h3 className="landing-footer-group-label">Community</h3>
            <ul className="landing-footer-group-list">
              {COMMUNITY_GROUP.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="landing-footer-link focus-ring flex items-center gap-2"
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                    >
                      <Icon className="size-4" />
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="landing-footer-group">
            <h3 className="landing-footer-group-label">Account</h3>
            <ul className="landing-footer-group-list">
              {ACCOUNT_GROUP.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="landing-footer-link focus-ring">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <div className="landing-footer-meta">
            <p className="landing-footer-copy">&copy; {year} Webhook Delivery</p>
            <nav className="landing-footer-legal" aria-label="Legal">
              {LEGAL_LINKS.map((link) => (
                <a key={link.label} href={link.href} className="landing-footer-legal-link focus-ring">
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <button
            type="button"
            onClick={scrollToTop}
            className="landing-footer-top focus-ring"
            aria-label="Back to top"
            title="Back to top"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
        </div>
      </LandingFrameInner>
    </footer>
  )
}
