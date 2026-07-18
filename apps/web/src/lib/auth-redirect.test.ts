import { describe, expect, it } from 'vitest'
import { getDefaultHomePath, getHomeLabel, getPostLoginPath } from './auth-redirect'

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
    expect(getPostLoginPath({ from: { pathname: '/deliveries' } }, { is_super_admin: false })).toBe(
      '/deliveries',
    )
  })

  it('sends users to dashboard from public paths', () => {
    expect(getPostLoginPath({ from: { pathname: '/' } }, { is_super_admin: false })).toBe(
      '/dashboard',
    )
  })
})
