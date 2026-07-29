import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  ChevronRight,
  KeyRound,
  Package,
  Send,
  Webhook,
  type LucideIcon,
} from 'lucide-react'
import { ApiError, getStats, listApiKeys, listDeliveries, listEndpoints, listEvents } from '@/api/client'
import type { Stats } from '@/api/types'
import { PageBanner } from '@/components/console/PageBanner'
import { ConsolePage } from '@/components/console/ConsolePage'
import { DataPanel } from '@/components/console/DataPanel'
import { DashboardQuickActions } from '@/components/console/DashboardQuickActions'
import { LiveChip } from '@/components/console/LiveChip'
import { LiveMetrics } from '@/components/console/LiveMetrics'
import { RecentActivity, type ActivityItem } from '@/components/console/RecentActivity'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPercent } from '@/lib/format'
import {
  buildOnboardingSteps,
  hasActiveEndpoint,
  type OnboardingStep,
  type OnboardingStepId,
} from '@/lib/tenant-onboarding'
import { cn } from '@/lib/utils'

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
      setIsLive(false)
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
      title="Dashboard"
      description="Ingest volume, queue depth, and 24-hour delivery outcomes."
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

          <DataPanel title="Metrics">
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
      value: formatPercent(stats.success_rate_24h, 'No data yet'),
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

const onboardingStepMeta: Record<
  OnboardingStepId,
  { icon: LucideIcon; hint: string; tone: 'info' | 'success' | 'neutral' }
> = {
  endpoint: {
    icon: Webhook,
    hint: 'Receiver URL and signing secret',
    tone: 'neutral',
  },
  api_key: {
    icon: KeyRound,
    hint: 'Bearer auth for ingest API',
    tone: 'neutral',
  },
  test_event: {
    icon: Send,
    hint: 'Console smoke test',
    tone: 'info',
  },
  deliveries: {
    icon: Package,
    hint: 'Outbound delivery attempts',
    tone: 'success',
  },
}

const onboardingToneIconClass = {
  info: 'dashboard-activity-row__icon--event',
  success: 'dashboard-activity-row__icon--delivery',
  neutral: 'dashboard-activity-row__icon--neutral',
} as const

function OnboardingStepRow({ step }: { step: OnboardingStep }) {
  const meta = onboardingStepMeta[step.id]
  const Icon = meta.icon

  const rowContent = (
    <>
      <span
        className={cn(
          'dashboard-activity-row__icon',
          step.done
            ? 'dashboard-activity-row__icon--success'
            : onboardingToneIconClass[meta.tone],
        )}
        aria-hidden="true"
      >
        {step.done ? (
          <Check className="size-4" strokeWidth={2.25} />
        ) : (
          <Icon className="size-4" strokeWidth={1.75} />
        )}
      </span>
      <div className="dashboard-activity-row__main">
        <p
          className={cn(
            'dashboard-activity-row__name',
            step.done && 'text-muted-strong line-through decoration-muted-strong/45',
          )}
        >
          {step.label}
        </p>
        <p className="dashboard-panel-row__hint">{meta.hint}</p>
      </div>
      {!step.done ? (
        <ChevronRight
          className="size-4 shrink-0 text-muted-strong/40 transition-colors duration-150 group-hover:text-primary"
          strokeWidth={2}
          aria-hidden="true"
        />
      ) : null}
    </>
  )

  if (step.done) {
    return <div className="dashboard-metric-row">{rowContent}</div>
  }

  return (
    <Link to={step.to} className="dashboard-activity-row group">
      {rowContent}
    </Link>
  )
}

function EmptyDashboardCTA() {
  const [steps, setSteps] = useState<OnboardingStep[]>(() =>
    buildOnboardingSteps({ hasEndpoint: false, hasApiKey: false }),
  )

  useEffect(() => {
    let cancelled = false
    Promise.all([listEndpoints({ limit: 100, offset: 0 }), listApiKeys()])
      .then(([endpoints, keys]) => {
        if (cancelled) return
        setSteps(
          buildOnboardingSteps({
            hasEndpoint: hasActiveEndpoint(endpoints.data),
            hasApiKey: keys.data.some((key) => !key.revoked_at),
          }),
        )
      })
      .catch(() => {
        // Keep the default unchecked checklist; empty-dashboard UX still works.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <DataPanel
      title="Get started"
      description="Wire a receiver, create a key, then smoke-test. Metrics show up once deliveries start."
    >
      <div className="dashboard-activity-list">
        {steps.map((step) => (
          <OnboardingStepRow key={step.id} step={step} />
        ))}
      </div>
    </DataPanel>
  )
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-page">
      <Skeleton className="h-18" />
      <Skeleton className="h-28" />
      <Skeleton className="h-32" />
      <Skeleton className="h-48" />
    </div>
  )
}
