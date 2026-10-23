import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPageCache } from '@/lib/page-cache'
import { PageCacheContext } from '@/providers/page-cache-context'
import { apiFetch } from '@/api/client'
import type { MeResponse } from '@/api/types'
import { SessionContext, type SessionProviderProps } from '@/providers/session-context'

export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<MeResponse>('/v1/auth/me', { skipAuthRedirect: true })
      setSession(data)
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const sessionKey = session
    ? JSON.stringify([
        session.user.id,
        session.tenant?.id,
        session.user.is_super_admin,
        session.tenant?.read_only,
      ])
    : null
  const pageCache = useMemo(() => (sessionKey === null ? null : createPageCache()), [sessionKey])
  useEffect(() => () => pageCache?.clear(), [pageCache])

  const value = useMemo(
    () => ({
      session,
      loading,
      refresh,
    }),
    [session, loading, refresh],
  )

  return (
    <SessionContext.Provider value={value}>
      <PageCacheContext.Provider value={pageCache}>{children}</PageCacheContext.Provider>
    </SessionContext.Provider>
  )
}
