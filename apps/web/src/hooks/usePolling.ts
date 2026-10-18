import { useEffect, useRef } from 'react'

const POLL_INTERVAL_MS = 5_000

type UsePollingOptions = {
  enabled?: boolean
  intervalMs?: number
  refreshOnVisible?: boolean
  onPoll: () => void | Promise<unknown>
}

export function usePolling({
  enabled = true,
  intervalMs = POLL_INTERVAL_MS,
  onPoll,
  refreshOnVisible = false,
}: UsePollingOptions) {
  const onPollRef = useRef(onPoll)
  const pollingRef = useRef(false)

  useEffect(() => {
    onPollRef.current = onPoll
  }, [onPoll])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const poll = async () => {
      if (document.hidden || pollingRef.current) return
      pollingRef.current = true
      try {
        await onPollRef.current()
      } catch {
        // Poll callbacks surface their own errors in the UI.
      } finally {
        pollingRef.current = false
      }
    }

    let timer: ReturnType<typeof setInterval> | null = null
    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
    const start = () => {
      if (!timer) {
        timer = setInterval(() => void poll(), intervalMs)
      }
    }
    let wasHidden = document.hidden
    const handleVisibilityChange = () => {
      if (document.hidden) stop()
      else {
        if (wasHidden && refreshOnVisible) void poll()
        start()
      }
      wasHidden = document.hidden
    }

    start()
    if (document.hidden) stop()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, intervalMs, refreshOnVisible])
}
