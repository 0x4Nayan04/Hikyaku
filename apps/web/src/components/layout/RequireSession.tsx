import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PageLoading } from '@/components/console/PageLoading'
import { useSession } from '@/providers/session-context'

export function RequireSession() {
  const { session, loading } = useSession()
  const location = useLocation()

  if (loading) {
    return <PageLoading variant="detail" />
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
