import { Navigate, Outlet } from 'react-router-dom'
import { getDefaultHomePath, hasTenantWorkspace, isPlatformContext } from '@/lib/auth/auth-redirect'
import { useSession } from '@/providers/session-context'

export function RequireTenantUser() {
  const { session, loading } = useSession()

  if (!loading && session && isPlatformContext(session)) {
    return <Navigate to={getDefaultHomePath(session.user)} replace />
  }

  if (!loading && session && !hasTenantWorkspace(session)) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
