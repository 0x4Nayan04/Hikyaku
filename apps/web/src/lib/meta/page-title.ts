import { docsPageBySlug, docsPathForAnchor, type DocsPage } from '@/docs/toc'
import { APP_NAME, PRODUCT_LINKS } from '@/lib/meta/app-meta'

function docsPageForPathname(pathname: string, hash: string): DocsPage | null {
  const slug = pathname.replace(/^\/docs\/?/, '').split('/')[0] ?? ''
  const page = docsPageBySlug(slug)
  if (page) return page
  // Legacy hash links like /docs#signing still resolve to their page title.
  const anchorPath = hash.startsWith('#') ? docsPathForAnchor(hash.slice(1)) : null
  const anchorSlug = (anchorPath ?? '').split('#')[0].replace(/^\/docs\//, '')
  return docsPageBySlug(anchorSlug)
}

/** Detail IDs collapse to a generic label. */
export function titleForPath(pathname: string, hash = ''): string {
  if (pathname.startsWith('/docs')) {
    const page = docsPageForPathname(pathname, hash)
    return page ? `${page.title} · ${APP_NAME} Docs` : `${APP_NAME} Docs`
  }
  if (pathname === '/') return APP_NAME
  // Avoid "Why Hikyaku · Hikyaku" from the generic `Label · APP_NAME` pattern.
  if (pathname === PRODUCT_LINKS.whyHikyaku || pathname === '/why-haiku') return `Why ${APP_NAME}`

  const routes: Array<[RegExp | string, string]> = [
    ['/login', 'Sign in'],
    ['/bootstrap', 'Setup'],
    ['/accept-invite', 'Accept invite'],
    ['/reset-password', 'Reset password'],
    ['/dashboard', 'Dashboard'],
    ['/endpoints', 'Endpoints'],
    ['/events/send', 'Test event'],
    [/^\/events\/[^/]+$/, 'Event'],
    ['/events', 'Events'],
    [/^\/deliveries\/[^/]+$/, 'Delivery'],
    ['/deliveries', 'Deliveries'],
    ['/settings', 'Settings'],
    [/^\/admin\/tenants\/[^/]+$/, 'Tenant'],
    ['/admin', 'Admin'],
  ]

  for (const [match, label] of routes) {
    const ok = typeof match === 'string' ? pathname === match : match.test(pathname)
    if (ok) return `${label} · ${APP_NAME}`
  }

  return `Not found · ${APP_NAME}`
}
