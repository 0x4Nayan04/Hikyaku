import { memo, useCallback } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { HikyakuMark } from '@/components/auth/HikyakuMark'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { getDefaultHomePath, getHomeLabel } from '@/lib/auth-redirect'
import { APP_NAME } from '@/lib/app-meta'
import { useSession } from '@/providers/session-context'

export const DocsHeader = memo(function DocsHeader() {
  const navigate = useNavigate()
  const { session, loading } = useSession()

  const goDashboard = useCallback(() => {
    if (session) {
      navigate(getDefaultHomePath(session.user))
      return
    }
    navigate('/login')
  }, [navigate, session])

  return (
    <header className="docs-header">
      <LandingFrameInner className="docs-header-inner">
        <div className="docs-header-brand">
          <Link to="/" className="docs-header-logo focus-ring" aria-label={`${APP_NAME} home`}>
            <HikyakuMark decorative className="size-7 shrink-0" />
            <span>{APP_NAME}</span>
          </Link>
          <span className="docs-header-divider" aria-hidden="true" />
          <NavLink to="/docs" end className="docs-header-docs-link">
            Docs
          </NavLink>
        </div>

        {!loading ? (
          <button type="button" className="docs-header-dashboard focus-ring" onClick={goDashboard}>
            <LayoutDashboard className="size-3.5" aria-hidden="true" />
            {session ? getHomeLabel(session.user) : 'Sign in'}
          </button>
        ) : null}
      </LandingFrameInner>
    </header>
  )
})
