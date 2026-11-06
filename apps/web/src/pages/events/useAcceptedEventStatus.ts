import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getEvent } from '@/api/client'
import type { EventStatus } from '@/api/types'
import { usePolling } from '@/hooks/usePolling'
import { POLL_FAST_MS } from '@/lib/ui-timing'
import { isOpenEventStatus } from '@/pages/events/sendEventFormState'

type AcceptedEvent = {
  id: string
  status: EventStatus
}

export function useAcceptedEventStatus(
  accepted: AcceptedEvent | null,
  onStatus: (id: string, status: EventStatus) => void,
): { statusError: string | null } {
  const acceptedId = accepted?.id
  const hasOpenAcceptedEvent = accepted !== null && isOpenEventStatus(accepted.status)
  const statusAbortRef = useRef<AbortController | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const refreshAcceptedEvent = useCallback(async () => {
    if (!acceptedId || statusAbortRef.current) return
    const controller = new AbortController()
    statusAbortRef.current = controller
    try {
      const event = await getEvent(acceptedId, { signal: controller.signal })
      if (controller.signal.aborted) return
      setStatusError(null)
      onStatus(acceptedId, event.status)
    } catch (err) {
      if (controller.signal.aborted) return
      setStatusError(err instanceof ApiError ? err.message : 'Failed to refresh event status')
    } finally {
      if (statusAbortRef.current === controller) statusAbortRef.current = null
    }
  }, [acceptedId, onStatus])

  useEffect(() => {
    setStatusError(null)
    if (!hasOpenAcceptedEvent) return
    void refreshAcceptedEvent()
    return () => {
      statusAbortRef.current?.abort()
      statusAbortRef.current = null
    }
  }, [hasOpenAcceptedEvent, refreshAcceptedEvent])

  usePolling({
    enabled: hasOpenAcceptedEvent,
    intervalMs: POLL_FAST_MS,
    refreshOnVisible: true,
    onPoll: refreshAcceptedEvent,
  })

  return { statusError }
}
