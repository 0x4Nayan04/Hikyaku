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
    const timer = setInterval(() => onPollRef.current(), intervalMs)
    return () => clearInterval(timer)
  }, [enabled, intervalMs])
}
