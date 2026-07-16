import { Navigate, Outlet } from 'react-router-dom'
import { getDefaultHomePath } from '@/lib/auth-redirect'
import { useSession } from '@/providers/session-context'

/** Public marketing routes — redirect authenticated users to their home. */
export function RequireGuest() {
  const { session, loading } = useSession()

  if (!loading && session) {
    return <Navigate to={getDefaultHomePath(session.user)} replace />
  }

  return <Outlet />
}
