import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, LayoutDashboard, Menu, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { HikyakuMark } from '@/components/auth/HikyakuMark'
import { useFocusTrap } from '@/components/accessibility/Accessibility'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useScrollSpy } from '@/hooks/useScrollSpy'
import { getDefaultHomePath } from '@/lib/auth-redirect'
import { APP_HOME_LABEL, APP_NAME } from '@/lib/app-meta'
import { useSession } from '@/providers/session-context'

const LANDING_SECTION_IDS = ['how-it-works', 'console', 'faq']

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works', sectionId: 'how-it-works', external: false },
  { label: 'Console', href: '#console', sectionId: 'console', external: false },
  { label: 'FAQ', href: '#faq', sectionId: 'faq', external: false },
  { label: 'Docs', href: '/docs', sectionId: null, external: false },
] as const

export const LandingNavbar = memo(function LandingNavbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useSession()
  const isLogin = location.pathname === '/login'
  const isSignup = location.pathname === '/signup'
  const isLanding = !isLogin && !isSignup
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileMenuRef = useFocusTrap(isMobileMenuOpen, {
    onEscape: () => setIsMobileMenuOpen(false),
  })
  const activeSectionId = useScrollSpy(isLanding ? LANDING_SECTION_IDS : [])

  const goHome = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      navigate('/')
    },
    [navigate],
  )

  useBodyScrollLock(isMobileMenuOpen)

  useEffect(() => {
    if (!isMobileMenuOpen) return
    const closeOnResize = () => {
      if (window.innerWidth >= 768) setIsMobileMenuOpen(false)
    }
    window.addEventListener('resize', closeOnResize)
    return () => window.removeEventListener('resize', closeOnResize)
  }, [isMobileMenuOpen])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname, location.hash])

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false)
    menuButtonRef.current?.focus()
  }, [])

  const primaryCta = isLogin
    ? { label: 'Request access', path: '/signup' }
    : isSignup
      ? { label: 'Sign in', path: '/login' }
      : { label: 'Request access', path: '/signup' }

  return (
    <header className="landing-nav">
      <LandingFrameInner className="landing-nav-inner-wrap">
        <div className="landing-nav-bar">
          <a
            href="/"
            onClick={goHome}
            className="landing-nav-brand focus-ring"
            aria-label={APP_HOME_LABEL}
          >
            <HikyakuMark className="size-7 shrink-0" />
            <span className="landing-nav-brand-text">{APP_NAME}</span>
          </a>

          <nav className="landing-nav-links hidden md:flex" aria-label="Page sections">
            {NAV_LINKS.map((item) =>
              item.external ? (
                <Link
                  key={item.label}
                  to={item.href}
                  className="landing-nav-link focus-ring"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  className={`landing-nav-link focus-ring${item.sectionId && activeSectionId === item.sectionId ? ' landing-nav-link--active' : ''}`}
                  aria-current={item.sectionId && activeSectionId === item.sectionId ? 'location' : undefined}
                >
                  {item.label}
                </a>
              ),
            )}
          </nav>

          <div className="landing-nav-actions">
            <div className="landing-nav-auth hidden sm:flex">
              {session ? (
                <button
                  type="button"
                  onClick={() => navigate(getDefaultHomePath(session.user))}
                  className="sm-btn sm-btn-primary sm-btn-split focus-ring"
                >
                  <span className="sm-btn-split-label">Dashboard</span>
                  <span className="sm-btn-split-icon">
                    <LayoutDashboard className="size-3.5" aria-hidden="true" />
                  </span>
                </button>
              ) : !loading && isLanding ? (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="sm-btn sm-btn-secondary focus-ring"
                >
                  Sign in
                </button>
              ) : null}
              {!session && !loading ? (
                <button
                  type="button"
                  onClick={() => navigate(primaryCta.path)}
                  className="sm-btn sm-btn-primary sm-btn-split focus-ring"
                >
                  <span className="sm-btn-split-label">{primaryCta.label}</span>
                  <span className="sm-btn-split-icon">
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                </button>
              ) : null}
            </div>
            <button
              type="button"
              ref={menuButtonRef}
              className="landing-nav-menu-btn md:hidden focus-ring"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="landing-mobile-menu"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              {isMobileMenuOpen ? (
                <X className="size-4" aria-hidden="true" />
              ) : (
                <Menu className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </LandingFrameInner>

      {isMobileMenuOpen ? (
        <div className="landing-nav-drawer md:hidden">
          <button
            type="button"
            className="landing-nav-drawer-backdrop"
            onClick={closeMobileMenu}
            aria-label="Close menu"
          />
          <div
            id="landing-mobile-menu"
            className="landing-nav-drawer-panel"
            ref={mobileMenuRef}
            aria-label="Site navigation"
          >
            <nav className="landing-nav-drawer-links" aria-label="Page sections">
              {NAV_LINKS.map((item) =>
                item.external ? (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="landing-nav-drawer-link"
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`landing-nav-drawer-link${item.sectionId && activeSectionId === item.sectionId ? ' landing-nav-drawer-link--active' : ''}`}
                    onClick={closeMobileMenu}
                    aria-current={item.sectionId && activeSectionId === item.sectionId ? 'location' : undefined}
                  >
                    {item.label}
                  </a>
                ),
              )}
            </nav>
            <div className="landing-nav-drawer-actions">
              {session ? (
                <button
                  type="button"
                  onClick={() => {
                    navigate(getDefaultHomePath(session.user))
                    closeMobileMenu()
                  }}
                  className="sm-btn sm-btn-primary w-full"
                >
                  Dashboard
                </button>
              ) : !loading ? (
                <>
                  {isLanding ? (
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/login')
                        closeMobileMenu()
                      }}
                      className="sm-btn sm-btn-secondary w-full"
                    >
                      Sign in
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      navigate(primaryCta.path)
                      closeMobileMenu()
                    }}
                    className="sm-btn sm-btn-primary w-full"
                  >
                    {primaryCta.label}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
})
