import { Navigate, Outlet } from 'react-router-dom'
import { getDefaultHomePath, hasAdminAccess } from '@/lib/auth/auth-redirect'
import { useSession } from '@/providers/session-context'

export function RequireSuperAdmin() {
  const { session, loading } = useSession()

  if (!loading && session && !hasAdminAccess(session.user)) {
    return <Navigate to={getDefaultHomePath(session.user)} replace />
  }

  return <Outlet />
}
