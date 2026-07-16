import { useNavigate } from 'react-router-dom'
import { BookOpen, LogOut } from 'lucide-react'
import { logout } from '@/api/client'
import type { MeResponse } from '@/api/types'
import { AppNav } from '@/components/app/AppNav'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useSession } from '@/providers/session-context'
import { useCallback } from 'react'

type AppAsideProps = {
  session: MeResponse | null
  loading: boolean
  isSuperAdmin: boolean
  className?: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function AppAside({ session, loading, isSuperAdmin, className }: AppAsideProps) {
  const navigate = useNavigate()
  const { refresh } = useSession()

  const workspaceLabel = isSuperAdmin
    ? 'Webhook Delivery'
    : (session?.tenant?.name ?? (loading ? 'Loading…' : 'Workspace'))

  const roleLabel = isSuperAdmin ? 'Super Admin' : 'Operator'

  const userName = session?.user?.name ?? session?.user?.email ?? (loading ? '…' : 'Account')
  const userEmail = session?.user?.email ?? ''
  const userInitials = userName ? initials(userName) : '?'

  const handleLogout = useCallback(async () => {
    await logout()
    await refresh()
    navigate('/login', { replace: true })
  }, [navigate, refresh])

  return (
    <aside className={cn('app-aside', className)}>

      {/* Workspace selector */}
      <div className="app-aside-workspace">
        <div className="app-aside-workspace-info">
          <div className="app-aside-workspace-row">
            <p className="app-aside-workspace-name">{workspaceLabel}</p>
            <Badge
              variant="outline"
              className="app-aside-workspace-badge"
            >
              {roleLabel}
            </Badge>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="app-aside-inner">
        <AppNav isSuperAdmin={isSuperAdmin} />
      </div>

      {/* User footer — avatar · name/email · docs · logout */}
      <div className="app-aside-footer">
        <div className="app-aside-user">
          <div className="app-aside-user-avatar" aria-hidden="true">
            {userInitials}
          </div>
          <div className="app-aside-user-info">
            <p className="app-aside-user-name">{userName}</p>
            {userEmail && <p className="app-aside-user-email">{userEmail}</p>}
          </div>
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="app-aside-icon-btn"
            title="Documentation"
            aria-label="Documentation"
          >
            <BookOpen className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="app-aside-logout-btn"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
