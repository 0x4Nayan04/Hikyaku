export const APP_NAME = 'Hikyaku'
export const APP_HOME_LABEL = `${APP_NAME} — home`

export const PRODUCT_LINKS = {
  docs: '/docs',
  /** Real console entry (sign-in / app). */
  console: '/login',
  faq: '/#faq',
  whyHikyaku: '/why-hikyaku',
  home: '/',
} as const

const DEFAULT_GITHUB_URL = 'https://github.com/0x4Nayan04/Hikyaku'
const DEFAULT_SOCIAL_URL = 'https://x.com/NayanSwarnkar04'

/** Public profile URLs — override with VITE_GITHUB_URL / VITE_SOCIAL_URL. */
export const PUBLIC_LINKS = {
  github: import.meta.env.VITE_GITHUB_URL || DEFAULT_GITHUB_URL,
  social: import.meta.env.VITE_SOCIAL_URL || DEFAULT_SOCIAL_URL,
} as const
