/** In-app product links (always valid). */
export const PRODUCT_LINKS = {
  docs: '/docs',
  console: '/#console',
  faq: '/#faq',
  howItWorks: '/#how-it-works',
  home: '/',
} as const

/** Optional public URLs — set via Vite env when the repo/social accounts exist. */
export const PUBLIC_LINKS = {
  github: import.meta.env.VITE_GITHUB_URL as string | undefined,
  social: import.meta.env.VITE_SOCIAL_URL as string | undefined,
}
