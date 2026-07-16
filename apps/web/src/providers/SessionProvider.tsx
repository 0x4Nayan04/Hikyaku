import { useCallback, useEffect, useMemo, useState } from 'react'
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

  const value = useMemo(
    () => ({
      session,
      loading,
      refresh,
    }),
    [session, loading, refresh],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
