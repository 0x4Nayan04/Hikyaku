import { describe, expect, it } from 'vitest'
import {
  LOGIN_FAILED_RECOVERY,
  LOGIN_PASSWORD_RESET_HINT,
  resolveGuestLandingPrimaryCta,
  resolveLoginBanner,
  shouldShowBootstrapSetupLink,
} from './auth-first-run'

describe('shouldShowBootstrapSetupLink', () => {
  it('shows the link only when bootstrap is available', () => {
    expect(shouldShowBootstrapSetupLink(true)).toBe(true)
    expect(shouldShowBootstrapSetupLink(false)).toBe(false)
  })

  it('hides the link while status is unknown', () => {
    expect(shouldShowBootstrapSetupLink(null)).toBe(false)
  })
})

describe('resolveGuestLandingPrimaryCta', () => {
  it('prefers bootstrap setup when available', () => {
    expect(resolveGuestLandingPrimaryCta(true)).toEqual({
      label: 'Run one-time setup',
      path: '/bootstrap',
    })
  })

  it('falls back to sign in when bootstrap is unavailable or unknown', () => {
    expect(resolveGuestLandingPrimaryCta(false)).toEqual({ label: 'Sign in', path: '/login' })
    expect(resolveGuestLandingPrimaryCta(null)).toEqual({ label: 'Sign in', path: '/login' })
  })
})

describe('resolveLoginBanner', () => {
  it('uses the setup title after bootstrap', () => {
    expect(resolveLoginBanner('bootstrap_complete', 'Super-admin created.').title).toBe(
      'Setup complete',
    )
  })

  it('uses the password-updated title after a password change', () => {
    expect(resolveLoginBanner('password_updated', 'Sign in again.')).toEqual({
      title: 'Password updated',
      variant: 'success',
      description: 'Sign in again.',
    })
  })
})

describe('login recovery copy', () => {
  it('states the password-reset policy up front', () => {
    expect(LOGIN_PASSWORD_RESET_HINT).toMatch(/no self-serve/i)
    expect(LOGIN_PASSWORD_RESET_HINT).toMatch(/fresh invite/i)
  })

  it('pairs invite and reset next steps after failed sign-in', () => {
    expect(LOGIN_FAILED_RECOVERY).toMatch(/invite/i)
    expect(LOGIN_FAILED_RECOVERY).toMatch(/password reset/i)
  })
})
