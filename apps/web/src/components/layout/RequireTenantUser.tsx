import { Navigate, Outlet } from 'react-router-dom'
import { getDefaultHomePath } from '@/lib/auth-redirect'
import { useSession } from '@/providers/session-context'

/**
 * Tenant-scoped console routes require a user bound to a tenant.
 * Super-admins are redirected before tenant API calls can fire.
 */
export function RequireTenantUser() {
  const { session, loading } = useSession()

  if (!loading && session?.user.is_super_admin) {
    return <Navigate to={getDefaultHomePath(session.user)} replace />
  }

  return <Outlet />
}
