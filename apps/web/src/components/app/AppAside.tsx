import { BookOpen, Shield } from 'lucide-react'
import type { MeResponse } from '@/api/types'
import { AppNav } from '@/components/app/AppNav'
import { cn } from '@/lib/utils'

type AppAsideProps = {
  session: MeResponse | null
  loading: boolean
  isSuperAdmin: boolean
  className?: string
}

function workspaceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function AppAside({ session, loading, isSuperAdmin, className }: AppAsideProps) {
  const workspaceLabel = isSuperAdmin
    ? 'Webhook Delivery'
    : (session?.tenant?.name ?? (loading ? 'Loading…' : 'Workspace'))

  const contextLabel = isSuperAdmin ? 'Platform' : 'Workspace'

  return (
    <aside className={cn('app-aside', className)}>
      <div className="app-aside-workspace">
        <span className="app-aside-workspace-mark" aria-hidden="true">
          {isSuperAdmin ? (
            <Shield className="size-3.5" strokeWidth={1.75} />
          ) : (
            workspaceInitials(workspaceLabel)
          )}
        </span>
        <div className="app-aside-workspace-text">
          <p className="app-aside-workspace-kicker">{contextLabel}</p>
          <p className="app-aside-workspace-name" title={workspaceLabel}>
            {workspaceLabel}
          </p>
        </div>
      </div>

      <div className="app-aside-inner">
        <AppNav isSuperAdmin={isSuperAdmin} />
      </div>

      <div className="app-aside-nav-footer">
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="app-aside-docs-link"
        >
          <BookOpen className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>Documentation</span>
        </a>
      </div>
    </aside>
  )
}
