import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPageCache } from '@/lib/page-cache'
import { PageCacheContext } from '@/providers/page-cache-context'
import { ApiError, getMe } from '@/api/client'
import type { MeResponse } from '@/api/types'
import { SessionContext, type SessionProviderProps } from '@/providers/session-context'

export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const refresh = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    setError(null)
    try {
      const data = await getMe()
      if (request === requestRef.current) setSession(data)
    } catch (err) {
      if (request !== requestRef.current) return
      if (err instanceof ApiError && err.status === 401) setSession(null)
      else
        setError(
          err instanceof ApiError
            ? err.message
            : 'Unable to load your session. Check your connection and try again.',
        )
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return () => {
      requestRef.current += 1
    }
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
      error,
      refresh,
    }),
    [session, loading, error, refresh],
  )

  return (
    <SessionContext.Provider value={value}>
      <PageCacheContext.Provider value={pageCache}>{children}</PageCacheContext.Provider>
    </SessionContext.Provider>
  )
}
