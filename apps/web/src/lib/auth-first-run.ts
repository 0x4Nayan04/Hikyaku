/** Whether Login should advertise the one-time /bootstrap setup link. */
export function shouldShowBootstrapSetupLink(available: boolean | null): boolean {
  return available === true
}

export type GuestLandingPrimaryCta =
  | { label: 'Run one-time setup'; path: '/bootstrap' }
  | { label: 'Sign in'; path: '/login' }

/** Bootstrap/invite first; signup stays a secondary path. */
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
  'Waiting on access? If you requested a workspace, an admin must approve it first — or ask for an invite.'

export type LoginBannerKind = 'bootstrap_complete' | 'request_received' | 'invite_accepted' | 'already_set_up'

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
    case 'request_received':
      return { title: 'Request received', variant: 'info', description: message }
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
