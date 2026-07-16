import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Zap,
} from 'lucide-react'
import { ApiError, getStats, listDeliveries, listEvents } from '@/api/client'
import type { Stats } from '@/api/types'
import { PageBanner } from '@/components/console/PageBanner'
import { ConsolePage } from '@/components/console/ConsolePage'
import { DataPanel } from '@/components/console/DataPanel'
import { DashboardQuickActions } from '@/components/console/DashboardQuickActions'
import { LiveChip } from '@/components/console/LiveChip'
import { LiveMetrics } from '@/components/console/LiveMetrics'
import { RecentActivity, type ActivityItem } from '@/components/console/RecentActivity'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPercent } from '@/lib/format'

const POLL_INTERVAL_MS = 10_000

type ActivityPreview = ActivityItem

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<ActivityPreview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isInitial, setIsInitial] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString())

  const load = useCallback(async () => {
    try {
      const data = await getStats()
      setStats(data)
      setError(null)
      setIsLive(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load stats')
    } finally {
      setIsInitial(false)
    }
  }, [])

  const loadActivity = useCallback(async () => {
    try {
      const [eventsResult, deliveriesResult] = await Promise.all([
        listEvents({ limit: 5, offset: 0 }),
        listDeliveries({ limit: 5, offset: 0 }),
      ])

      const merged: ActivityPreview[] = [
        ...eventsResult.data.map((event) => ({
          id: `event-${event.id}`,
          kind: 'event' as const,
          eventType: event.type,
          status: event.status,
          to: `/events/${event.id}`,
          createdAt: event.created_at,
        })),
        ...deliveriesResult.data.map((delivery) => ({
          id: `delivery-${delivery.id}`,
          kind: 'delivery' as const,
          eventType: `Delivery ${delivery.status.replace('_', ' ')}`,
          status: delivery.status,
          to: `/deliveries/${delivery.id}`,
          createdAt: delivery.created_at,
          attemptCount: delivery.attempt_count,
        })),
      ]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 5)

      setActivity(merged)
      setLastUpdated(new Date().toISOString())
    } catch {
      setActivity([])
    }
  }, [])

  useEffect(() => {
    void load()
    void loadActivity()
    const id = window.setInterval(() => {
      void load()
      void loadActivity()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [load, loadActivity])

  const hasData = stats !== null && (
    stats.events_today > 0 ||
    stats.deliveries_active > 0 ||
    stats.deliveries_deferred > 0 ||
    stats.deliveries_succeeded_24h > 0 ||
    stats.deliveries_failed_24h > 0
  )

  return (
    <ConsolePage
      marker="Overview"
      title="Delivery health"
      description="Live metrics for ingest volume, queue depth, and 24-hour delivery outcomes."
      actions={<LiveChip active={isLive} />}
    >
      {error ? (
        <PageBanner variant="error" title="Could not load stats" description={error} />
      ) : null}

      {isInitial && !stats ? (
        <DashboardSkeleton />
      ) : stats ? (
        <div className="dashboard-page">
          {!hasData ? <EmptyDashboardCTA /> : null}

          <DataPanel title="Live metrics">
            <LiveMetrics stats={stats} />
          </DataPanel>

          {hasData ? <OutcomesPanel stats={stats} /> : null}

          <DataPanel title="Quick actions">
            <DashboardQuickActions />
          </DataPanel>

          <RecentActivity
            items={activity}
            lastUpdated={lastUpdated}
            isLive={isLive}
            onRefresh={() => { void load(); void loadActivity(); }}
          />
        </div>
      ) : null}
    </ConsolePage>
  )
}

function OutcomesPanel({ stats }: { stats: Stats }) {
  const rows = [
    {
      label: 'Success rate',
      hint: 'Rolling 24-hour delivery success',
      value: formatPercent(stats.success_rate_24h),
      primary: true,
    },
    {
      label: 'Succeeded',
      hint: 'Completed deliveries',
      value: stats.deliveries_succeeded_24h.toLocaleString(),
      primary: false,
    },
    {
      label: 'Failed',
      hint: 'Exhausted retries or errors',
      value: stats.deliveries_failed_24h.toLocaleString(),
      primary: false,
    },
  ] as const

  return (
    <DataPanel title="24h outcomes">
      <div className="dashboard-activity-list">
        {rows.map((row) => (
          <div key={row.label} className="dashboard-metric-row dashboard-metric-row--plain">
            <div className="dashboard-activity-row__main">
              <p className="dashboard-activity-row__name">{row.label}</p>
              <p className="dashboard-panel-row__hint">{row.hint}</p>
            </div>
            <span
              className={
                row.primary
                  ? 'dashboard-stat-value dashboard-stat-value--primary'
                  : 'dashboard-stat-value'
              }
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </DataPanel>
  )
}

function EmptyDashboardCTA() {
  return (
    <DataPanel title="Get started">
      <div className="dashboard-onboarding">
        <span className="dashboard-onboarding__icon" aria-hidden="true">
          <Zap className="size-5" strokeWidth={1.75} />
        </span>
        <div className="dashboard-onboarding__main">
          <p className="dashboard-onboarding__title">Welcome to Webhook Delivery</p>
          <p className="dashboard-onboarding__desc">
            Create an endpoint and send your first event. Delivery metrics will appear here once data starts flowing.
          </p>
        </div>
        <div className="dashboard-onboarding__actions">
          <CatalogButton asChild className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]">
            <Link to="/endpoints">
              Create endpoint
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </CatalogButton>
          <CatalogButton variant="secondary" asChild className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]">
            <Link to="/events/send">Send a test event</Link>
          </CatalogButton>
        </div>
      </div>
    </DataPanel>
  )
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-page">
      <Skeleton className="h-[4.5rem]" />
      <Skeleton className="h-28" />
      <Skeleton className="h-32" />
      <Skeleton className="h-48" />
    </div>
  )
}
