import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  ChevronRight,
  Package,
  RefreshCw,
  Send,
} from 'lucide-react'
import { DataPanel } from '@/components/console/DataPanel'
import { cn } from '@/lib/utils'

const fullFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
})

export type ActivityItem = {
  id: string
  kind: 'event' | 'delivery'
  eventType: string
  status: string
  to: string
  createdAt: string
  attemptCount?: number
}

type RecentActivityProps = {
  items: ActivityItem[]
  lastUpdated: string
  isLive: boolean
  onRefresh: () => void
}

function formatFull(iso: string): string {
  return fullFormatter.format(new Date(iso))
}

function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso))
}

function formatStatusLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatActivityMeta(item: ActivityItem): string {
  const parts = [
    item.kind === 'event' ? 'Event' : 'Delivery',
    formatStatusLabel(item.status),
    formatFull(item.createdAt),
  ]

  if (item.attemptCount != null) {
    parts.splice(
      2,
      0,
      `${item.attemptCount} attempt${item.attemptCount !== 1 ? 's' : ''}`,
    )
  }

  return parts.join(' · ')
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const isEvent = item.kind === 'event'

  return (
    <Link to={item.to} className="dashboard-activity-row group">
      <span
        className={cn(
          'dashboard-activity-row__icon',
          isEvent ? 'dashboard-activity-row__icon--event' : 'dashboard-activity-row__icon--delivery',
        )}
        aria-hidden="true"
      >
        {isEvent ? (
          <Send className="size-4" strokeWidth={1.75} />
        ) : (
          <Package className="size-4" strokeWidth={1.75} />
        )}
      </span>
      <div className="dashboard-activity-row__main">
        <p className="dashboard-activity-row__name">{item.eventType}</p>
        <p className="dashboard-panel-row__hint">{formatActivityMeta(item)}</p>
      </div>
      <ChevronRight
        className="size-4 shrink-0 text-muted-strong/40 transition-colors duration-150 group-hover:text-primary"
        strokeWidth={2}
        aria-hidden="true"
      />
    </Link>
  )
}

function ActivityFooter({
  isLive,
  lastUpdated,
  onRefresh,
}: {
  isLive: boolean
  lastUpdated: string
  onRefresh: () => void
}) {
  return (
    <div className="dashboard-panel-footer">
      <button
        type="button"
        onClick={onRefresh}
        className="ra-refresh-btn"
      >
        <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        Refresh
      </button>
      <p className="dashboard-panel-footer__meta">
        {isLive ? (
          <>
            <span className="dashboard-panel-footer__live" aria-hidden="true" />
            Auto-refresh on
            <span className="dashboard-panel-footer__sep" aria-hidden="true">
              ·
            </span>
          </>
        ) : null}
        Last updated {formatTime(lastUpdated)}
      </p>
    </div>
  )
}

export function RecentActivity({ items, lastUpdated, isLive, onRefresh }: RecentActivityProps) {
  return (
    <DataPanel
      title="Recent activity"
      description="Latest events and deliveries"
      actions={
        <Link to="/events" className="ra-cta-btn">
          View all events
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      }
      empty={
        items.length === 0 ? (
          <div className="dashboard-activity-empty">
            <span className="dashboard-activity-empty__icon" aria-hidden="true">
              <Activity className="size-5" strokeWidth={1.75} />
            </span>
            <p>No recent events or deliveries yet.</p>
          </div>
        ) : undefined
      }
      emptyFlush
      footer={
        <ActivityFooter isLive={isLive} lastUpdated={lastUpdated} onRefresh={onRefresh} />
      }
    >
      {items.length > 0 ? (
        <div className="dashboard-activity-list">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </DataPanel>
  )
}
