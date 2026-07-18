import { describe, expect, it } from 'vitest'
import {
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
  it('uses a distinct title for pending signup vs bootstrap', () => {
    expect(resolveLoginBanner('request_received', 'Wait for approval.').title).toBe(
      'Request received',
    )
    expect(resolveLoginBanner('bootstrap_complete', 'Super-admin created.').title).toBe(
      'Setup complete',
    )
  })
})
