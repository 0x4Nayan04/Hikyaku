import { useEffect, useRef } from 'react'

const POLL_INTERVAL_MS = 5_000

type UsePollingOptions = {
  enabled?: boolean
  intervalMs?: number
  onPoll: () => void
}

export function usePolling({
  enabled = true,
  intervalMs = POLL_INTERVAL_MS,
  onPoll,
}: UsePollingOptions) {
  const onPollRef = useRef(onPoll)

  useEffect(() => {
    onPollRef.current = onPoll
  }, [onPoll])

  useEffect(() => {
    if (!enabled) {
      return
    }

    let polling = false
    const poll = async () => {
      if (document.hidden || polling) return
      polling = true
      try {
        await onPollRef.current()
      } catch {
        // Poll callbacks surface their own errors in the UI.
      } finally {
        polling = false
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
    const handleVisibilityChange = () => {
      if (document.hidden) stop()
      else start()
    }

    start()
    if (document.hidden) stop()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, intervalMs])
}
