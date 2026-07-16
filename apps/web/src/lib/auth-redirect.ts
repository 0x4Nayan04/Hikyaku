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

function isTenantOnlyPath(pathname: string): boolean {
  return pathname !== ADMIN_HOME && !pathname.startsWith('/admin/')
}

export function getDefaultHomePath(user: Pick<User, 'is_super_admin'>): string {
  return user.is_super_admin ? ADMIN_HOME : TENANT_HOME
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
