import { useEffect, useState } from 'react'
import { ApiError, listEndpoints } from '@/api/client'

export type EndpointGate =
  | { status: 'loading' }
  | { status: 'ready'; canSend: true }
  | { status: 'ready'; canSend: false; reason: 'none' | 'all_disabled' }
  | { status: 'error'; message: string }

export function useEndpointGate(): EndpointGate {
  const [gate, setGate] = useState<EndpointGate>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    Promise.all([listEndpoints({ limit: 1 }), listEndpoints({ status: 'active', limit: 1 })])
      .then(([anyEndpoints, activeEndpoints]) => {
        if (cancelled) return
        if (activeEndpoints.data.length > 0) {
          setGate({ status: 'ready', canSend: true })
          return
        }
        setGate({
          status: 'ready',
          canSend: false,
          reason: anyEndpoints.data.length > 0 ? 'all_disabled' : 'none',
        })
      })
      .catch((err) => {
        if (!cancelled) {
          setGate({
            status: 'error',
            message: err instanceof ApiError ? err.message : 'Failed to load endpoints',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return gate
}
