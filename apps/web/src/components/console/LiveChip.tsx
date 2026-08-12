import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/format'

type LiveChipProps = {
  active?: boolean
  /** ISO timestamp from the last successful poll. */
  lastUpdated?: string
}

export function LiveChip({ active = true, lastUpdated }: LiveChipProps) {
  if (!active) return null

  const hint = lastUpdated
    ? `Auto-refreshes about every 10s. Last updated ${formatDateTime(lastUpdated)}.`
    : 'Auto-refreshes about every 10s while this page is open.'

  return (
    <Badge
      variant="outline"
      title={hint}
      aria-label={hint}
      className="console-live-chip gap-1.5 border-status-success-border bg-status-success-subtle font-mono text-[0.6rem] uppercase tracking-wider text-status-success"
    >
      <span className="size-1.5 animate-pulse bg-status-success" aria-hidden />
      Live
    </Badge>
  )
}
