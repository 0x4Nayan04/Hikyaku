import type { User } from '@/api/types'

type LoginLocationState = {
  message?: string
  from?: {
    pathname: string
    search?: string
    hash?: string
  }
}

const TENANT_HOME = '/dashboard'
const ADMIN_HOME = '/admin'

const PUBLIC_PATHS = new Set([
  '/',
  '/why-haiku',
  '/login',
  '/bootstrap',
  '/accept-invite',
  '/reset-password',
])

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname === '/docs' || pathname.startsWith('/docs/')
}

function parseLocalPath(value: string | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null
  }

  try {
    const url = new URL(value, 'http://hikyaku.local')
    if (url.origin !== 'http://hikyaku.local' || isPublicPath(url.pathname)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

/** Paths both roles may use (not bounced for super-admin). */
function isSharedPath(pathname: string): boolean {
  return pathname === '/settings' || pathname.startsWith('/settings/')
}

function isTenantOnlyPath(pathname: string): boolean {
  if (pathname === ADMIN_HOME || pathname.startsWith('/admin/')) return false
  if (isSharedPath(pathname)) return false
  return true
}

export function getDefaultHomePath(user: Pick<User, 'is_super_admin' | 'tenant_id'>): string {
  return user.is_super_admin && !user.tenant_id ? ADMIN_HOME : TENANT_HOME
}

/** CTA label for the role home (Dashboard vs Admin). */
export function getHomeLabel(user: Pick<User, 'is_super_admin' | 'tenant_id'>): string {
  return user.is_super_admin && !user.tenant_id ? 'Admin' : 'Dashboard'
}

export function getLoginPath(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  const returnTo = parseLocalPath(`${location.pathname}${location.search}${location.hash}`)
  return returnTo ? `/login?${new URLSearchParams({ returnTo })}` : '/login'
}

export function getPostLoginPath(
  state: unknown,
  user: Pick<User, 'is_super_admin' | 'tenant_id'>,
  returnTo?: string,
): string {
  const locationState = state as LoginLocationState | null
  const from = locationState?.from
  const path = parseLocalPath(
    from ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}` : returnTo,
  )

  if (!path) {
    return getDefaultHomePath(user)
  }

  const pathname = new URL(path, 'http://hikyaku.local').pathname

  if (user.is_super_admin && !user.tenant_id && isTenantOnlyPath(pathname)) {
    return ADMIN_HOME
  }

  return path
}
