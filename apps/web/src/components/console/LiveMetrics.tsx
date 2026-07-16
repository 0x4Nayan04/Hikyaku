import { Activity, PauseCircle, Zap, type LucideIcon } from 'lucide-react'
import type { Stats } from '@/api/types'
import { cn } from '@/lib/utils'

type LiveMetricsProps = {
  stats: Pick<Stats, 'events_today' | 'deliveries_active' | 'deliveries_deferred'>
}

type MetricTone = 'info' | 'success' | 'warning'

const metrics: {
  label: string
  hint: string
  key: keyof Pick<Stats, 'events_today' | 'deliveries_active' | 'deliveries_deferred'>
  icon: LucideIcon
  tone: MetricTone
}[] = [
  {
    label: 'Events today',
    hint: 'Since UTC midnight',
    key: 'events_today',
    icon: Zap,
    tone: 'info',
  },
  {
    label: 'Active deliveries',
    hint: 'Pending or in flight',
    key: 'deliveries_active',
    icon: Activity,
    tone: 'success',
  },
  {
    label: 'Deferred',
    hint: 'Waiting for retry',
    key: 'deliveries_deferred',
    icon: PauseCircle,
    tone: 'warning',
  },
]

const toneIconClass: Record<MetricTone, string> = {
  info: 'dashboard-activity-row__icon--event',
  success: 'dashboard-activity-row__icon--delivery',
  warning: 'dashboard-activity-row__icon--warning',
}

export function LiveMetrics({ stats }: LiveMetricsProps) {
  return (
    <div className="dashboard-activity-list">
      {metrics.map((metric) => {
        const Icon = metric.icon
        return (
          <div key={metric.key} className="dashboard-metric-row">
            <span
              className={cn('dashboard-activity-row__icon', toneIconClass[metric.tone])}
              aria-hidden="true"
            >
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <div className="dashboard-activity-row__main">
              <p className="dashboard-activity-row__name">{metric.label}</p>
              <p className="dashboard-panel-row__hint">{metric.hint}</p>
            </div>
            <span className="dashboard-stat-value">
              {stats[metric.key].toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}
