export const MIN_PASSWORD_LENGTH = 12

export const DEMO_CREDENTIALS = {
  email: 'demo@hikyaku.example',
  password: 'hikyaku-demo-read-only',
} as const

export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300

export const INVITE_KINDS = {
  TENANT_OWNER: 'tenant_owner',
  TENANT_USER: 'tenant_user',
  PASSWORD_RESET: 'password_reset',
} as const

export const SIGNUP_INVITE_KINDS = [INVITE_KINDS.TENANT_OWNER, INVITE_KINDS.TENANT_USER] as const
export type InviteKind = (typeof INVITE_KINDS)[keyof typeof INVITE_KINDS]
