import type { ReactNode } from 'react'
import { SessionContext } from '@/providers/session-context'

export function SessionTestProvider({ children }: { children: ReactNode }) {
  return (
    <SessionContext.Provider
      value={{ session: null, loading: false, refresh: async () => undefined }}
    >
      {children}
    </SessionContext.Provider>
  )
}
