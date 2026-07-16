import { Navigate, Outlet, useOutletContext } from 'react-router-dom'
import type { AppOutletContext } from '@/layouts/app-context'
import { getDefaultHomePath } from '@/lib/auth-redirect'

export function RequireSuperAdmin() {
  const { session, loadingSession } = useOutletContext<AppOutletContext>()

  if (!loadingSession && session && !session.user.is_super_admin) {
    return <Navigate to={getDefaultHomePath(session.user)} replace />
  }

  return <Outlet context={{ session, loadingSession }} />
}
