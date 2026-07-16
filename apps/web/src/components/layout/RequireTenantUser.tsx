import { Navigate, Outlet, useOutletContext } from 'react-router-dom'
import type { AppOutletContext } from '@/layouts/app-context'
import { getDefaultHomePath } from '@/lib/auth-redirect'

/**
 * Tenant-scoped console routes require a user bound to a tenant.
 * Super-admins are redirected before tenant API calls can fire.
 */
export function RequireTenantUser() {
  const { session, loadingSession } = useOutletContext<AppOutletContext>()

  if (!loadingSession && session?.user.is_super_admin) {
    return <Navigate to={getDefaultHomePath(session.user)} replace />
  }

  return <Outlet context={{ session, loadingSession }} />
}
