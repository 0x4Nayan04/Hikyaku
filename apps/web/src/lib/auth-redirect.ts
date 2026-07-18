import type { User } from '@/api/types'

type LoginLocationState = {
  message?: string
  from?: {
    pathname: string
  }
}

const TENANT_HOME = '/dashboard'
const ADMIN_HOME = '/admin'

const PUBLIC_PATHS = new Set(['/', '/login', '/signup', '/bootstrap', '/accept-invite'])

/** Paths both roles may use (not bounced for super-admin). */
function isSharedPath(pathname: string): boolean {
  return pathname === '/settings' || pathname.startsWith('/settings/')
}

function isTenantOnlyPath(pathname: string): boolean {
  if (pathname === ADMIN_HOME || pathname.startsWith('/admin/')) return false
  if (isSharedPath(pathname)) return false
  return true
}

export function getDefaultHomePath(user: Pick<User, 'is_super_admin'>): string {
  return user.is_super_admin ? ADMIN_HOME : TENANT_HOME
}

/** CTA label for the role home (Dashboard vs Admin). */
export function getHomeLabel(user: Pick<User, 'is_super_admin'>): string {
  return user.is_super_admin ? 'Admin' : 'Dashboard'
}

export function getPostLoginPath(state: unknown, user: Pick<User, 'is_super_admin'>): string {
  const locationState = state as LoginLocationState | null
  const pathname = locationState?.from?.pathname

  if (!pathname || PUBLIC_PATHS.has(pathname)) {
    return getDefaultHomePath(user)
  }

  if (user.is_super_admin && isTenantOnlyPath(pathname)) {
    return ADMIN_HOME
  }

  return pathname
}
