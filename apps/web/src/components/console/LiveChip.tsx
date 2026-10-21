import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/format'
import { POLL_DEFAULT_MS } from '@/lib/ui-timing'

type LiveChipProps = {
  active?: boolean
  lastUpdated?: string
  intervalMs?: number
}

function pollHint(intervalMs: number, lastUpdated?: string): string {
  const seconds = Math.round(intervalMs / 1000)
  return lastUpdated
    ? `Auto-refreshes about every ${seconds}s. Last updated ${formatDateTime(lastUpdated)}.`
    : `Auto-refreshes about every ${seconds}s while this page is open.`
}

export function LiveChip({
  active = true,
  lastUpdated,
  intervalMs = POLL_DEFAULT_MS,
}: LiveChipProps) {
  if (!active) return null

  const hint = pollHint(intervalMs, lastUpdated)

  return (
    <Badge
      variant="outline"
      title={hint}
      aria-label={hint}
      className="console-live-chip gap-1.5 border-status-success-border bg-status-success-subtle font-mono text-[0.6rem] uppercase tracking-wider text-status-success"
    >
      <span className="size-1.5 animate-pulse motion-reduce:animate-none bg-status-success" aria-hidden />
      Live
    </Badge>
  )
}
