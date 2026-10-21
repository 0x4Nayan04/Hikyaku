import { PRODUCT_LINKS } from '@/lib/app-meta'

/** Public marketing routes crawlers may index. Console and auth stay noindex. */
export function robotsForPath(pathname: string): 'index,follow' | 'noindex,nofollow' {
  if (pathname === '/') return 'index,follow'
  if (pathname === PRODUCT_LINKS.whyHikyaku || pathname === '/why-haiku') return 'index,follow'
  if (pathname === PRODUCT_LINKS.docs || pathname.startsWith(`${PRODUCT_LINKS.docs}/`)) {
    return 'index,follow'
  }
  return 'noindex,nofollow'
}
