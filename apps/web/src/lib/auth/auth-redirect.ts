import type { MeResponse, User } from '@/api/types'
import { PRODUCT_LINKS } from '@/lib/meta/app-meta'

import type { LoginBannerKind } from '@/lib/auth/auth-first-run'

export type LoginLocationState = {
  banner?: LoginBannerKind
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
  PRODUCT_LINKS.whyHikyaku,
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

function isSharedPath(pathname: string): boolean {
  return pathname === '/settings' || pathname.startsWith('/settings/')
}

function isTenantOnlyPath(pathname: string): boolean {
  if (pathname === ADMIN_HOME || pathname.startsWith('/admin/')) return false
  if (isSharedPath(pathname)) return false
  return true
}

export function hasAdminAccess(user: Pick<User, 'is_super_admin'> | null | undefined): boolean {
  return user?.is_super_admin === true
}

export function hasTenantWorkspace(session: MeResponse | null): boolean {
  return session?.tenant != null
}

export function isPlatformContext(session: MeResponse | null): boolean {
  return hasAdminAccess(session?.user) && !hasTenantWorkspace(session)
}

export function getDefaultHomePath(user: Pick<User, 'is_super_admin' | 'tenant_id'>): string {
  return hasAdminAccess(user) && !user.tenant_id ? ADMIN_HOME : TENANT_HOME
}

export function getHomeLabel(user: Pick<User, 'is_super_admin' | 'tenant_id'>): string {
  return hasAdminAccess(user) && !user.tenant_id ? 'Admin' : 'Dashboard'
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

  if (hasAdminAccess(user) && !user.tenant_id && isTenantOnlyPath(pathname)) {
    return ADMIN_HOME
  }

  return path
}
