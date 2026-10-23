import { createContext, use } from 'react'
import type { createPageCache } from '@/lib/page-cache'

export const PageCacheContext = createContext<ReturnType<typeof createPageCache> | null>(null)

export function usePageCache() {
  return use(PageCacheContext)
}
