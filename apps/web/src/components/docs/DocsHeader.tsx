import { memo, useCallback, useState } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { HikyakuMark } from '@/components/auth/HikyakuMark'
import { DocsSearch, DocsSearchTrigger } from '@/components/docs/DocsSearch'
import { LandingFrameInner } from '@/components/landing/LandingFrameInner'
import { getDefaultHomePath } from '@/lib/auth-redirect'
import { APP_NAME } from '@/lib/app-meta'
import { useSession } from '@/providers/session-context'

export const DocsHeader = memo(function DocsHeader() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [searchOpen, setSearchOpen] = useState(false)

  const goDashboard = useCallback(() => {
    if (session) {
      navigate(getDefaultHomePath(session.user))
      return
    }
    navigate('/login')
  }, [navigate, session])

  return (
    <>
      <header className="docs-v2-header">
        <LandingFrameInner className="docs-v2-header-inner">
          <div className="docs-v2-header-brand">
            <Link to="/" className="docs-v2-header-logo focus-ring" aria-label={`${APP_NAME} home`}>
              <HikyakuMark className="size-7 shrink-0" />
              <span>{APP_NAME}</span>
            </Link>
            <span className="docs-v2-header-divider" aria-hidden="true" />
            <NavLink to="/docs" end className="docs-v2-header-docs-link">
              Documentation
            </NavLink>
          </div>

          <div className="docs-v2-header-actions">
            <DocsSearchTrigger onClick={() => setSearchOpen(true)} />
            {!loading ? (
              <button type="button" className="docs-v2-header-dashboard focus-ring" onClick={goDashboard}>
                <LayoutDashboard className="size-3.5" aria-hidden="true" />
                {session ? 'Dashboard' : 'Sign in'}
              </button>
            ) : null}
          </div>
        </LandingFrameInner>
      </header>
      <DocsSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
})
