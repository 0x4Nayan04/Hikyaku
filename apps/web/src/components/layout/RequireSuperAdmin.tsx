import { Navigate, Outlet } from 'react-router-dom'
import { getDefaultHomePath } from '@/lib/auth-redirect'
import { useSession } from '@/providers/session-context'

export function RequireSuperAdmin() {
  const { session, loading } = useSession()

  if (!loading && session && !session.user.is_super_admin) {
    return <Navigate to={getDefaultHomePath(session.user)} replace />
  }

  return <Outlet />
}
