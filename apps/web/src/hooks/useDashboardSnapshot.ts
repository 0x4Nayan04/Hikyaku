import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getStats, listDeliveries, listEndpoints, listEvents } from '@/api/client'
import type { Stats } from '@/api/types'
import { usePageCache } from '@/providers/page-cache-context'
import type { DashboardSnapshot } from '@/lib/page-cache'
import { buildOnboardingSteps, type OnboardingStep } from '@/lib/auth/tenant-onboarding'
import { POLL_DEFAULT_MS } from '@/lib/ui-timing'
import { usePolling } from '@/hooks/usePolling'

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

export function hasDashboardData(stats: Stats): boolean {
  return (
    stats.events_today > 0 ||
    stats.deliveries_active > 0 ||
    stats.deliveries_succeeded_24h > 0 ||
    stats.deliveries_failed_24h > 0
  )
}

export function useDashboardSnapshot() {
  const cache = usePageCache()?.dashboard
  const [snapshot, setSnapshot] = useState(() => cache?.read('dashboard'))
  const [error, setError] = useState<string | null>(null)
  const [isInitial, setIsInitial] = useState(!snapshot)
  const [isLive, setIsLive] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(Boolean(snapshot))
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    const generation = cache?.generation
    setIsRefreshing(true)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller
    const stale = () => signal.aborted || generation !== cache?.generation

    try {
      const [data, disabled, eventsResult, deliveriesResult] = await Promise.all([
        getStats({ signal }),
        listEndpoints({ status: 'disabled', limit: 1 }, { signal }),
        listEvents({ limit: 5, offset: 0 }, { signal }),
        listDeliveries({ limit: 5, offset: 0 }, { signal }),
      ])

      let nextOnboarding: OnboardingStep[] | null = null
      let nextOnboardingError: string | null = null
      if (!hasDashboardData(data)) {
        try {
          const activeEndpoints = await listEndpoints({ status: 'active', limit: 1 }, { signal })
          const hasActiveEndpoint = activeEndpoints.data.length > 0
          const hasAnyEndpoint = hasActiveEndpoint || disabled.data.length > 0
          nextOnboarding = buildOnboardingSteps({
            hasActiveEndpoint,
            hasAnyEndpoint,
            hasTestEvent: eventsResult.data.length > 0,
            hasDeliveries: deliveriesResult.data.length > 0,
          })
        } catch (err) {
          if (isAbortError(err)) throw err
          nextOnboardingError =
            err instanceof ApiError ? err.message : 'Failed to check active endpoints'
        }
      }

      if (stale()) return
      const next: DashboardSnapshot = {
        stats: data,
        hasDisabledEndpoint: disabled.data.length > 0,
        events: eventsResult.data,
        deliveries: deliveriesResult.data,
        onboarding: nextOnboarding,
        onboardingError: nextOnboardingError,
        lastUpdated: new Date().toISOString(),
      }
      if (generation !== undefined) cache?.write('dashboard', next, generation)
      setSnapshot(next)
      setError(null)
      setIsLive(true)
    } catch (err) {
      if (isAbortError(err) || stale()) return
      controller.abort()
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        cache?.clear()
        setSnapshot(undefined)
      }
      setIsInitial(false)
      setError(err instanceof ApiError ? err.message : 'Failed to load stats')
      setIsLive(false)
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setIsRefreshing(false)
      }
      if (!stale()) setIsInitial(false)
    }
  }, [cache])

  useEffect(() => {
    void load()
    return () => {
      abortRef.current?.abort()
    }
  }, [load])

  const refresh = useCallback(async () => {
    if (abortRef.current) return
    await load()
  }, [load])

  usePolling({
    intervalMs: POLL_DEFAULT_MS,
    refreshOnVisible: true,
    onPoll: refresh,
  })

  return { snapshot, error, isInitial, isLive, isRefreshing, load }
}
