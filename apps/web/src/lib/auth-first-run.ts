/** Whether Login should advertise the one-time /bootstrap setup link. */
export function shouldShowBootstrapSetupLink(available: boolean | null): boolean {
  return available === true
}

export type GuestLandingPrimaryCta =
  | { label: 'Run one-time setup'; path: '/bootstrap' }
  | { label: 'Sign in'; path: '/login' }

/** Bootstrap the first admin; all tenant accounts are invitation-only. */
export function resolveGuestLandingPrimaryCta(
  bootstrapAvailable: boolean | null,
): GuestLandingPrimaryCta {
  if (bootstrapAvailable === true) {
    return { label: 'Run one-time setup', path: '/bootstrap' }
  }
  return { label: 'Sign in', path: '/login' }
}

/** Soft hint after failed login — does not confirm whether the email exists. */
export const LOGIN_PENDING_ACCESS_HINT =
  'Waiting on access? Ask the platform admin for a tenant invite.'

export type LoginBannerKind = 'bootstrap_complete' | 'invite_accepted' | 'already_set_up'

export type LoginBanner = {
  title: string
  variant: 'success' | 'info'
  description: string
}

export function resolveLoginBanner(
  kind: LoginBannerKind | undefined,
  message: string,
): LoginBanner {
  switch (kind) {
    case 'bootstrap_complete':
      return { title: 'Setup complete', variant: 'success', description: message }
    case 'invite_accepted':
      return { title: 'Account ready', variant: 'success', description: message }
    case 'already_set_up':
      return { title: 'Already set up', variant: 'info', description: message }
    case undefined:
      return { title: 'Ready to sign in', variant: 'success', description: message }
    default: {
      kind satisfies never
      return { title: 'Ready to sign in', variant: 'success', description: message }
    }
  }
}
