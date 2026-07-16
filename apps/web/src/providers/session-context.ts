import { createContext, use, type ReactNode } from 'react'
import type { MeResponse } from '@/api/types'

export type SessionContextValue = {
  session: MeResponse | null
  loading: boolean
  refresh: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const context = use(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return context
}

export type SessionProviderProps = { children: ReactNode }
