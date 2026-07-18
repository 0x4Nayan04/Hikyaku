import { useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { AppAside } from '@/components/app/AppAside'
import { AppTopBar } from '@/components/app/AppTopBar'
import { AppCatalogShell } from '@/components/app/AppCatalogShell'
import { ScrollToTop } from '@/components/console/ScrollToTop'
import type { AppOutletContext } from '@/layouts/app-context'
import { isTenantSuspended } from '@/lib/tenant-status'
import { SuspendedTenant } from '@/pages/SuspendedTenant'
import { useSession } from '@/providers/session-context'

export function ConsoleLayout() {
  const mainRef = useRef<HTMLElement>(null)
  const { session, loading } = useSession()
  const isSuperAdmin = session?.user.is_super_admin ?? false
  const outletContext: AppOutletContext = {
    session,
    loadingSession: loading,
  }

  if (!loading && isTenantSuspended(session)) {
    return <SuspendedTenant />
  }

  return (
    <AppCatalogShell>
      <AppTopBar session={session} loading={loading} isSuperAdmin={isSuperAdmin} />
      <div className="flex min-h-0 flex-1">
        <AppAside session={session} loading={loading} isSuperAdmin={isSuperAdmin} />
        <main id="main-content" ref={mainRef} className="app-main">
          <div className="app-main-inner">
            <Outlet context={outletContext} />
          </div>
        </main>
        <ScrollToTop scrollContainerRef={mainRef} />
      </div>
    </AppCatalogShell>
  )
}
