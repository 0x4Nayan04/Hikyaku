import { APP_NAME } from '@/lib/app-meta'
import { DOCS_TOC } from '@/docs/toc'

/** Map a pathname (+ optional hash) to `document.title`. Detail IDs collapse to a generic label. */
export function titleForPath(pathname: string, hash = ''): string {
  if (pathname.startsWith('/docs')) {
    const id = hash.replace(/^#/, '')
    const section = DOCS_TOC.find((item) => item.id === id)
    return section ? `${section.label} · ${APP_NAME} Docs` : `${APP_NAME} Docs`
  }
  if (pathname === '/') return APP_NAME

  const routes: Array<[RegExp | string, string]> = [
    ['/login', 'Sign in'],
    ['/bootstrap', 'Setup'],
    ['/accept-invite', 'Accept invite'],
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
