import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Settings, Shield, User, X } from 'lucide-react'
import { logout } from '@/api/client'
import type { MeResponse } from '@/api/types'
import { WebhookMark } from '@/components/auth/WebhookMark'
import { AppNav } from '@/components/app/AppNav'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useFocusTrap } from '@/components/accessibility/Accessibility'
import { useSession } from '@/providers/session-context'
import { useCallback, useEffect, useRef, useState } from 'react'

type AppTopBarProps = {
  session: MeResponse | null
  loading: boolean
  isSuperAdmin: boolean
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function AppTopBar({ session, loading, isSuperAdmin }: AppTopBarProps) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownButtonRef = useRef<HTMLButtonElement>(null)
  const mobileMenuRef = useFocusTrap(menuOpen, { onEscape: () => setMenuOpen(false) })
  const dropdownTrapRef = useFocusTrap(dropdownOpen, {
    onEscape: () => setDropdownOpen(false),
    restoreFocus: true,
  })

  useBodyScrollLock(menuOpen)

  useEffect(() => {
    if (!dropdownOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const goHome = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      navigate('/')
    },
    [navigate],
  )

  const closeMobileMenu = useCallback(() => {
    setMenuOpen(false)
    menuButtonRef.current?.focus()
  }, [])

  const { refresh } = useSession()

  async function handleLogout() {
    await logout()
    await refresh()
    navigate('/login', { replace: true })
  }

  const workspaceLabel = isSuperAdmin
    ? 'Platform admin'
    : (session?.tenant?.name ?? 'Workspace')

  return (
    <header className="app-topbar">
      <LandingFrameInner className="h-full">
        <div className="flex h-full items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              ref={menuButtonRef}
              className="landing-mobile-menu-btn lg:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {menuOpen ? (
                <X className="size-4" aria-hidden="true" />
              ) : (
                <Menu className="size-4" aria-hidden="true" />
              )}
            </button>
            <a
              href="/"
              onClick={goHome}
              className="landing-nav-brand focus-ring"
              aria-label="Webhook Delivery — home"
            >
              <WebhookMark className="size-7 shrink-0 text-primary" />
              <span className="landing-nav-brand-text">Webhook Delivery</span>
            </a>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            {session ? (
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  ref={dropdownButtonRef}
                  className="nav-user-trigger outline-none"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="menu"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                >
                  <span className="nav-user-avatar">
                    <span className="nav-user-avatar-fallback" aria-hidden="true">
                      {initials(session.user.name)}
                    </span>
                  </span>
                </button>

                {dropdownOpen ? (
                  <div ref={dropdownTrapRef} className="nav-user-menu" role="menu">
                    <div className="nav-user-menu-identity">
                      <div className="min-w-0">
                        <p className="nav-user-menu-name">{session.user.name}</p>
                        <p className="nav-user-menu-email">{session.user.email}</p>
                      </div>
                    </div>

                    <div className="nav-user-menu-list">
                      <button
                        type="button"
                        role="menuitem"
                        className="nav-user-menu-row"
                        onClick={() => {
                          navigate('/settings?tab=profile')
                          setDropdownOpen(false)
                        }}
                      >
                        <User className="nav-user-menu-row-icon" aria-hidden="true" />
                        <span className="nav-user-menu-row-label">Profile</span>
                      </button>
                      {isSuperAdmin ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="nav-user-menu-row"
                          onClick={() => {
                            navigate('/admin')
                            setDropdownOpen(false)
                          }}
                        >
                          <Shield className="nav-user-menu-row-icon" aria-hidden="true" />
                          <span className="nav-user-menu-row-label">Admin</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          className="nav-user-menu-row"
                          onClick={() => {
                            navigate('/settings?tab=tenant')
                            setDropdownOpen(false)
                          }}
                        >
                          <Settings className="nav-user-menu-row-icon" aria-hidden="true" />
                          <span className="nav-user-menu-row-label">Settings</span>
                        </button>
                      )}
                    </div>

                    <div className="nav-user-menu-footer">
                      <button
                        type="button"
                        role="menuitem"
                        className="nav-user-menu-row nav-user-menu-row--danger"
                        onClick={() => {
                          void handleLogout()
                          setDropdownOpen(false)
                        }}
                      >
                        <LogOut className="nav-user-menu-row-icon" aria-hidden="true" />
                        <span className="nav-user-menu-row-label">Log out</span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : !loading ? (
              <Link to="/login" className="sm-btn sm-btn-primary">
                Sign in
              </Link>
            ) : null}
          </div>
        </div>
      </LandingFrameInner>

      {menuOpen ? (
        <div className="landing-mobile-menu-overlay lg:hidden">
          <button
            type="button"
            className="absolute inset-0 size-full cursor-default"
            onClick={closeMobileMenu}
            aria-label="Close menu"
          />
          <div
            className="landing-mobile-menu-panel console-mobile-menu-panel relative z-10"
            ref={mobileMenuRef}
            aria-label="Console navigation"
          >
            <div className="console-mobile-menu-header">
              <a
                href="/"
                onClick={(event) => {
                  goHome(event)
                  closeMobileMenu()
                }}
                className="landing-nav-brand focus-ring"
                aria-label="Webhook Delivery — home"
              >
                <WebhookMark className="size-6 text-primary" />
                <span className="landing-nav-brand-text">Console</span>
              </a>
              <p className="console-mobile-menu-tenant">{workspaceLabel}</p>
              <button
                type="button"
                className="landing-mobile-menu-btn"
                aria-label="Close menu"
                onClick={closeMobileMenu}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="p-4">
              <AppNav
                isSuperAdmin={isSuperAdmin}
                variant="mobile"
                onNavigate={closeMobileMenu}
              />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
