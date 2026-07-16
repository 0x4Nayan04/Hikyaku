import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { apiUrl } from '@/api/client'
import type { Delivery } from '@/api/types'

const POLL_INTERVAL_MS = 10_000
const SSE_RETRY_MS = 30_000

export type DeliveryConnectionMode = 'connecting' | 'sse' | 'polling'

type UseDeliveryLiveUpdatesOptions = {
  enabled?: boolean
  onDeliveryUpdated?: (delivery: Delivery) => void
  onPoll?: () => void
}

type ConnectionStore = {
  mode: DeliveryConnectionMode
  listeners: Set<() => void>
  setMode: (mode: DeliveryConnectionMode) => void
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => DeliveryConnectionMode
}

function createConnectionStore(): ConnectionStore {
  const listeners = new Set<() => void>()
  let mode: DeliveryConnectionMode = 'connecting'

  return {
    mode,
    listeners,
    setMode(next) {
      if (mode !== next) {
        mode = next
        listeners.forEach((listener) => listener())
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return mode
    },
  }
}

export function useDeliveryLiveUpdates({
  enabled = true,
  onDeliveryUpdated,
  onPoll,
}: UseDeliveryLiveUpdatesOptions) {
  const [store] = useState(createConnectionStore)

  const onDeliveryUpdatedRef = useRef(onDeliveryUpdated)
  const onPollRef = useRef(onPoll)

  useEffect(() => {
    onDeliveryUpdatedRef.current = onDeliveryUpdated
    onPollRef.current = onPoll
  })

  useEffect(() => {
    if (!enabled) {
      return
    }

    let disposed = false
    let eventSource: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const clearPollTimer = () => {
      if (pollTimer !== null) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    const clearRetryTimer = () => {
      if (retryTimer !== null) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
    }

    const handleDeliveryUpdated = (event: Event) => {
      try {
        const delivery = JSON.parse((event as MessageEvent).data) as Delivery
        onDeliveryUpdatedRef.current?.(delivery)
      } catch {
        // Ignore malformed SSE payloads.
      }
    }

    const closeEventSource = () => {
      if (!eventSource) {
        return
      }
      eventSource.removeEventListener('delivery_updated', handleDeliveryUpdated)
      eventSource.close()
      eventSource = null
    }

    const startPolling = () => {
      clearPollTimer()
      store.setMode('polling')
      onPollRef.current?.()
      pollTimer = setInterval(() => {
        onPollRef.current?.()
      }, POLL_INTERVAL_MS)
    }

    const connectSse = () => {
      if (disposed) {
        return
      }

      clearPollTimer()
      clearRetryTimer()
      store.setMode('connecting')
      closeEventSource()

      eventSource = new EventSource(apiUrl('/v1/deliveries/stream'), {
        withCredentials: true,
      })

      eventSource.addEventListener('delivery_updated', handleDeliveryUpdated)

      eventSource.onopen = () => {
        if (!disposed) {
          clearPollTimer()
          store.setMode('sse')
        }
      }

      eventSource.onerror = () => {
        closeEventSource()

        if (!disposed) {
          startPolling()
          retryTimer = setTimeout(connectSse, SSE_RETRY_MS)
        }
      }
    }

    connectSse()

    return () => {
      disposed = true
      closeEventSource()
      clearPollTimer()
      clearRetryTimer()
      store.setMode('connecting')
    }
  }, [enabled, store])

  const mode = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)

  return { mode }
}
