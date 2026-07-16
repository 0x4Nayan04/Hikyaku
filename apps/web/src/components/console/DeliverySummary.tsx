import {
  CheckCircle2,
  Clock3,
  Package,
  PauseCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { DeliveriesSummary } from '@/api/types'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

type DeliverySummaryProps = {
  summary: DeliveriesSummary
}

type SummaryMetric = {
  key: keyof Omit<DeliveriesSummary, 'total'>
  label: string
  hint: string
  icon: LucideIcon
  tone: 'success' | 'danger' | 'neutral' | 'warning'
  barClass: string
}

const breakdownMetrics: SummaryMetric[] = [
  {
    key: 'succeeded',
    label: 'Succeeded',
    hint: 'Delivered successfully',
    icon: CheckCircle2,
    tone: 'success',
    barClass: 'delivery-summary__segment--success',
  },
  {
    key: 'failed',
    label: 'Failed',
    hint: 'Exhausted retries or errors',
    icon: XCircle,
    tone: 'danger',
    barClass: 'delivery-summary__segment--danger',
  },
  {
    key: 'pending',
    label: 'Pending',
    hint: 'Queued or in flight',
    icon: Clock3,
    tone: 'neutral',
    barClass: 'delivery-summary__segment--pending',
  },
  {
    key: 'deferred',
    label: 'Deferred',
    hint: 'Waiting for retry',
    icon: PauseCircle,
    tone: 'warning',
    barClass: 'delivery-summary__segment--deferred',
  },
]

const toneIconClass: Record<SummaryMetric['tone'], string> = {
  success: 'dashboard-activity-row__icon--success',
  danger: 'dashboard-activity-row__icon--danger',
  neutral: 'dashboard-activity-row__icon--neutral',
  warning: 'dashboard-activity-row__icon--warning',
}

const toneValueClass: Record<SummaryMetric['tone'], string> = {
  success: 'text-status-success',
  danger: 'text-status-danger',
  neutral: 'text-ink',
  warning: 'text-status-warning',
}

function shareLabel(count: number, total: number): string {
  if (total === 0) {
    return 'No deliveries yet'
  }
  return `${formatPercent(count / total)} of total`
}

function buildBarAriaLabel(summary: DeliveriesSummary): string {
  const parts = breakdownMetrics
    .filter((metric) => summary[metric.key] > 0)
    .map((metric) => `${summary[metric.key]} ${metric.label.toLowerCase()}`)

  if (parts.length === 0) {
    return 'No delivery outcomes recorded'
  }

  return `Delivery breakdown: ${parts.join(', ')}`
}

export function DeliverySummary({ summary }: DeliverySummaryProps) {
  const { total } = summary
  const finished = summary.succeeded + summary.failed
  const successRate = finished > 0 ? summary.succeeded / finished : null
  const activeSegments = breakdownMetrics.filter((metric) => summary[metric.key] > 0)

  if (total === 0) {
    return (
      <div className="dashboard-activity-empty">
        <span className="dashboard-activity-empty__icon" aria-hidden="true">
          <Package className="size-4" strokeWidth={1.75} />
        </span>
        <p className="m-0">No deliveries were created for this event.</p>
      </div>
    )
  }

  return (
    <div className="delivery-summary">
      <div className="delivery-summary__hero">
        <div className="delivery-summary__hero-stat">
          <p className="delivery-summary__hero-label">Total deliveries</p>
          <p className="delivery-summary__hero-value">{total.toLocaleString()}</p>
        </div>
        <div className="delivery-summary__hero-stat delivery-summary__hero-stat--end">
          <p className="delivery-summary__hero-label">Success rate</p>
          <p
            className={cn(
              'delivery-summary__hero-value',
              successRate !== null && successRate >= 0.5 && 'text-status-success',
              successRate !== null && successRate < 0.5 && 'text-status-danger',
            )}
          >
            {formatPercent(successRate)}
          </p>
          <p className="delivery-summary__hero-hint">
            {finished > 0
              ? `Among ${finished.toLocaleString()} finished`
              : 'No finished deliveries yet'}
          </p>
        </div>
      </div>

      <div
        className="delivery-summary__bar"
        role="img"
        aria-label={buildBarAriaLabel(summary)}
      >
        {activeSegments.map((metric) => (
          <div
            key={metric.key}
            className={cn('delivery-summary__segment', metric.barClass)}
            style={{ flexGrow: summary[metric.key], flexBasis: 0 }}
          />
        ))}
      </div>

      <div className="dashboard-activity-list">
        {breakdownMetrics.map((metric) => {
          const Icon = metric.icon
          const count = summary[metric.key]

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
                <p className="dashboard-panel-row__hint">{shareLabel(count, total)}</p>
              </div>
              <span className={cn('dashboard-stat-value', toneValueClass[metric.tone])}>
                {count.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
