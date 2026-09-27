import { describe, expect, it } from 'vitest'
import { getDefaultHomePath, getHomeLabel, getLoginPath, getPostLoginPath } from './auth-redirect'

describe('auth-redirect', () => {
  it('sends super-admin to admin home', () => {
    expect(getDefaultHomePath({ is_super_admin: true })).toBe('/admin')
    expect(getDefaultHomePath({ is_super_admin: false })).toBe('/dashboard')
  })

  it('labels role home Dashboard vs Admin', () => {
    expect(getHomeLabel({ is_super_admin: true })).toBe('Admin')
    expect(getHomeLabel({ is_super_admin: false })).toBe('Dashboard')
  })

  it('redirects super-admin away from tenant routes after login', () => {
    expect(getPostLoginPath({ from: { pathname: '/endpoints' } }, { is_super_admin: true })).toBe(
      '/admin',
    )
    expect(getPostLoginPath({ from: { pathname: '/admin' } }, { is_super_admin: true })).toBe(
      '/admin',
    )
  })

  it('keeps super-admin on shared /settings after login', () => {
    expect(getPostLoginPath({ from: { pathname: '/settings' } }, { is_super_admin: true })).toBe(
      '/settings',
    )
    expect(
      getPostLoginPath({ from: { pathname: '/settings/profile' } }, { is_super_admin: true }),
    ).toBe('/settings/profile')
  })

  it('restores tenant deep links for tenant owners', () => {
    expect(
      getPostLoginPath(
        { from: { pathname: '/deliveries', search: '?status=failed', hash: '#attempts' } },
        { is_super_admin: false },
      ),
    ).toBe('/deliveries?status=failed#attempts')
  })

  it('restores a safe hard-redirect destination', () => {
    expect(getPostLoginPath(null, { is_super_admin: false }, '/settings?tab=api-keys#keys')).toBe(
      '/settings?tab=api-keys#keys',
    )
  })

  it('rejects public and unsafe destinations', () => {
    const user = { is_super_admin: false }
    expect(getPostLoginPath(null, user, '//example.com')).toBe('/dashboard')
    expect(getPostLoginPath(null, user, '/\\example.com')).toBe('/dashboard')
    expect(getPostLoginPath(null, user, '/login?returnTo=/deliveries')).toBe('/dashboard')
    expect(getPostLoginPath(null, user, '/docs/setup')).toBe('/dashboard')
  })

  it('sends users to dashboard from public paths', () => {
    expect(getPostLoginPath({ from: { pathname: '/' } }, { is_super_admin: false })).toBe(
      '/dashboard',
    )
  })
})

it('builds a login URL containing the current path, query, and hash', () => {
  expect(
    getLoginPath({ pathname: '/deliveries', search: '?status=failed', hash: '#attempts' }),
  ).toBe('/login?returnTo=%2Fdeliveries%3Fstatus%3Dfailed%23attempts')
})

it('opens the assigned workspace for a super-admin', () => {
  expect(getDefaultHomePath({ is_super_admin: true, tenant_id: 'workspace' })).toBe('/dashboard')
  expect(
    getPostLoginPath(
      { from: { pathname: '/endpoints' } },
      { is_super_admin: true, tenant_id: 'workspace' },
    ),
  ).toBe('/endpoints')
})
