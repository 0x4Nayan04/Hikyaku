import { Badge } from '@/components/ui/badge'

type LiveChipProps = {
  active?: boolean
}

export function LiveChip({ active = true }: LiveChipProps) {
  if (!active) return null

  return (
    <Badge
      variant="outline"
      className="console-live-chip gap-1.5 border-status-success-border bg-status-success-subtle font-mono text-[0.6rem] uppercase tracking-wider text-status-success"
    >
      <span className="size-1.5 animate-pulse bg-status-success" aria-hidden />
      Live
    </Badge>
  )
}
