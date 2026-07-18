/** Product brand — single source for UI naming. */
export const APP_NAME = 'Hikyaku'
export const APP_TAGLINE = 'Signed webhook delivery with retries and attempt logs.'
export const APP_DESCRIPTION =
  'Multi-tenant webhook delivery: HMAC-signed HTTP, automatic retries, and a console for events and deliveries.'
/** Home link aria-label pattern. */
export const APP_HOME_LABEL = `${APP_NAME} — home`

/** In-app product links (always valid). */
export const PRODUCT_LINKS = {
  docs: '/docs',
  /** Real console entry (not the landing screenshot section). */
  console: '/login',
  faq: '/#faq',
  howItWorks: '/#how-it-works',
  home: '/',
} as const

const DEFAULT_GITHUB_URL = 'https://github.com/0x4Nayan04/Hikyaku'
const DEFAULT_SOCIAL_URL = 'https://x.com/NayanSwarnkar04'

/** Public profile URLs — override with VITE_GITHUB_URL / VITE_SOCIAL_URL. */
export const PUBLIC_LINKS = {
  github: (import.meta.env.VITE_GITHUB_URL as string | undefined) || DEFAULT_GITHUB_URL,
  social: (import.meta.env.VITE_SOCIAL_URL as string | undefined) || DEFAULT_SOCIAL_URL,
} as const
