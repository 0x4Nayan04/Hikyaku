export function shouldShowBootstrapSetupLink(available: boolean | null): boolean {
  return available === true
}

type GuestLandingPrimaryCta =
  | { label: 'Run one-time setup'; path: '/bootstrap' }
  | { label: 'Sign in'; path: '/login' }

export function resolveGuestLandingPrimaryCta(
  bootstrapAvailable: boolean | null,
): GuestLandingPrimaryCta {
  if (bootstrapAvailable === true) {
    return { label: 'Run one-time setup', path: '/bootstrap' }
  }
  return { label: 'Sign in', path: '/login' }
}

export const LOGIN_PASSWORD_RESET_HINT =
  'Ask Admin for a one-time reset link. There is no self-serve password reset.'

export type LoginBannerKind =
  | 'bootstrap_complete'
  | 'invite_accepted'
  | 'already_set_up'
  | 'password_updated'

type LoginBanner = {
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
