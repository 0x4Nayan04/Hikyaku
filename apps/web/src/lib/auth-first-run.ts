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

/** Password policy shown up front on the login form (no self-serve reset). */
export const LOGIN_PASSWORD_RESET_HINT =
  'Ask a platform admin to delete your user and send a fresh invite. There is no self-serve or admin password reset.'

/** Combined invite + reset next steps after a failed sign-in. */
export const LOGIN_FAILED_RECOVERY =
  'Need an invite? Ask your platform admin. Need a password reset? Ask them to delete your user and send a fresh invite — there is no self-serve reset.'

export type LoginBannerKind =
  | 'bootstrap_complete'
  | 'invite_accepted'
  | 'already_set_up'
  | 'password_updated'

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
    case 'password_updated':
      return { title: 'Password updated', variant: 'success', description: message }
    case undefined:
      return { title: 'Ready to sign in', variant: 'success', description: message }
    default: {
      kind satisfies never
      return { title: 'Ready to sign in', variant: 'success', description: message }
    }
  }
}
