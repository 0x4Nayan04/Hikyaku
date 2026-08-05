import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, LayoutDashboard, Menu, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { HikyakuMark } from '@/components/auth/HikyakuMark'
import { useFocusTrap } from '@/components/accessibility/Accessibility'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useScrollSpy } from '@/hooks/useScrollSpy'
import { getDefaultHomePath, getHomeLabel } from '@/lib/auth-redirect'
import { APP_HOME_LABEL, APP_NAME, PRODUCT_LINKS } from '@/lib/app-meta'
import { useSession } from '@/providers/session-context'

const LANDING_SECTION_IDS = ['how-it-works', 'faq']
const PRIMARY_CTA = { label: 'Sign in', path: '/login' }

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works', sectionId: 'how-it-works' },
  { label: 'Console', href: PRODUCT_LINKS.console, sectionId: null },
  { label: 'FAQ', href: '#faq', sectionId: 'faq' },
  { label: 'Docs', href: PRODUCT_LINKS.docs, sectionId: null },
] as const

export const LandingNavbar = memo(function LandingNavbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useSession()
  const isLogin = location.pathname === '/login'
  const isLanding = !isLogin
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileMenuRef = useFocusTrap(isMobileMenuOpen, {
    onEscape: () => setIsMobileMenuOpen(false),
  })
  const activeSectionId = useScrollSpy(isLanding ? LANDING_SECTION_IDS : [])

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

  return (
    <header className="landing-nav">
      <LandingFrameInner className="landing-nav-inner-wrap">
        <div className="landing-nav-bar">
          <Link
            to="/"
            className="landing-nav-brand focus-ring"
            aria-label={APP_HOME_LABEL}
          >
            <HikyakuMark className="size-7 shrink-0" />
            <span className="landing-nav-brand-text">{APP_NAME}</span>
          </Link>

          <nav className="landing-nav-links hidden md:flex" aria-label="Page sections">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className={`landing-nav-link focus-ring${item.sectionId && activeSectionId === item.sectionId ? ' landing-nav-link--active' : ''}`}
                aria-current={
                  item.sectionId && activeSectionId === item.sectionId ? 'location' : undefined
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="landing-nav-actions">
            <div className="landing-nav-auth hidden sm:flex">
              {session ? (
                <button
                  type="button"
                  onClick={() => navigate(getDefaultHomePath(session.user))}
                  className="sm-btn sm-btn-primary sm-btn-split focus-ring"
                >
                  <span className="sm-btn-split-label">{getHomeLabel(session.user)}</span>
                  <span className="sm-btn-split-icon">
                    <LayoutDashboard className="size-3.5" aria-hidden="true" />
                  </span>
                </button>
              ) : null}
              {!session && !loading ? (
                <button
                  type="button"
                  onClick={() => navigate(PRIMARY_CTA.path)}
                  className="sm-btn sm-btn-primary sm-btn-split focus-ring"
                >
                  <span className="sm-btn-split-label">{PRIMARY_CTA.label}</span>
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
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`landing-nav-drawer-link${item.sectionId && activeSectionId === item.sectionId ? ' landing-nav-drawer-link--active' : ''}`}
                  onClick={closeMobileMenu}
                  aria-current={
                    item.sectionId && activeSectionId === item.sectionId ? 'location' : undefined
                  }
                >
                  {item.label}
                </Link>
              ))}
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
                  {getHomeLabel(session.user)}
                </button>
              ) : !loading ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(PRIMARY_CTA.path)
                      closeMobileMenu()
                    }}
                    className="sm-btn sm-btn-primary w-full"
                  >
                    {PRIMARY_CTA.label}
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
