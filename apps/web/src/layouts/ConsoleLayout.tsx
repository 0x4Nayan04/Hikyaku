import { Suspense, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { AppAside } from '@/components/app/AppAside'
import { AppTopBar } from '@/components/app/AppTopBar'
import { AppCatalogShell } from '@/components/app/AppCatalogShell'
import { PageLoading } from '@/components/console/PageLoading'
import { ScrollToTop } from '@/components/console/ScrollToTop'
import { useSession } from '@/providers/session-context'
import '@/styles/console-bridge.css'

export function ConsoleLayout() {
  const mainRef = useRef<HTMLElement>(null)
  const { session, loading } = useSession()
  const isSuperAdmin = session?.user.is_super_admin ?? false

  return (
    <AppCatalogShell>
      <AppTopBar session={session} loading={loading} isSuperAdmin={isSuperAdmin} />
      <div className="flex min-h-0 flex-1">
        <AppAside session={session} loading={loading} isSuperAdmin={isSuperAdmin} />
        <main id="main-content" ref={mainRef} className="app-main">
          <div className="app-main-inner">
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <ScrollToTop scrollContainerRef={mainRef} />
      </div>
    </AppCatalogShell>
  )
}
