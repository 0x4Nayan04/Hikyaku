import { Link } from 'react-router-dom'
import {
  Check,
  ChevronRight,
  Clock,
  Send,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Delivery, DeliveryStatus } from '@/api/types'
import { StatusBadge } from '@/components/console/StatusBadge'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type StatusVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

function getVariant(status: DeliveryStatus): StatusVariant {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'deferred') return 'warning'
  if (status === 'in_progress') return 'info'
  return 'neutral'
}

const nodeIcons: Record<StatusVariant, LucideIcon> = {
  info: Send,
  success: Check,
  danger: X,
  warning: Clock,
  neutral: Clock,
}

function shortId(value: string): string {
  if (value.length <= 12) return value
  return `${value.slice(0, 8)}…`
}

const badgeClass =
  'h-[1.375rem] rounded-none border px-2 py-0 font-sans text-[0.6875rem] font-medium'

type DeliveryCatalogRowProps = {
  delivery: Delivery
}

function DeliveryCatalogRow({ delivery }: DeliveryCatalogRowProps) {
  const variant = getVariant(delivery.status)
  const NodeIcon = nodeIcons[variant]

  return (
    <div className="delivery-catalog-row">
      <div className={cn('delivery-catalog-row__node', `delivery-catalog-row__node--${variant}`)} aria-hidden="true">
        <NodeIcon className="size-3.5" strokeWidth={2.25} />
      </div>

      <Link to={`/deliveries/${delivery.id}`} className="delivery-catalog-row__link group">
        <div className="delivery-catalog-row__main">
          <p className="delivery-catalog-row__title">
            <span className="font-mono text-xs text-muted-strong">Event</span>{' '}
            <span className="font-mono">{shortId(delivery.event_id)}</span>
          </p>
          <div className="delivery-catalog-row__meta">
            <StatusBadge kind="delivery" status={delivery.status} className={badgeClass} />
            <Badge
              variant="outline"
              className={cn(
                badgeClass,
                'border-border bg-muted/50 font-mono text-muted-strong',
              )}
            >
              {shortId(delivery.endpoint_id)}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                badgeClass,
                'border-border bg-muted/50 text-muted-strong',
              )}
            >
              {delivery.attempt_count} attempt{delivery.attempt_count !== 1 ? 's' : ''}
            </Badge>
            {delivery.last_error ? (
              <span className="delivery-catalog-row__error" title={delivery.last_error}>
                {delivery.last_error}
              </span>
            ) : null}
          </div>
        </div>

        <div className="delivery-catalog-row__aside">
          <time className="delivery-catalog-row__time tabular-nums" dateTime={delivery.updated_at}>
            {formatDateTime(delivery.updated_at)}
          </time>
          <ChevronRight
            className="size-4 text-muted-strong/40 transition-colors duration-150 group-hover:text-muted-strong/70"
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>
      </Link>
    </div>
  )
}

type DeliveryCatalogListProps = {
  deliveries: Delivery[]
}

export function DeliveryCatalogList({ deliveries }: DeliveryCatalogListProps) {
  return (
    <div className="delivery-catalog-list">
      {deliveries.map((delivery) => (
        <DeliveryCatalogRow key={delivery.id} delivery={delivery} />
      ))}
    </div>
  )
}
