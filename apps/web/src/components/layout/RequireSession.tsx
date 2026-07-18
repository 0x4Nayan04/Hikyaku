import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { PageLoading } from '@/components/console/PageLoading'
import type { AppOutletContext } from '@/layouts/app-context'

export function RequireSession() {
  const { session, loadingSession } = useOutletContext<AppOutletContext>()
  const location = useLocation()

  if (loadingSession) {
    return <PageLoading variant="detail" />
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet context={{ session, loadingSession }} />
}
