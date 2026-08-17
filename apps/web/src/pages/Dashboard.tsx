import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  KeyRound,
  Package,
  PowerOff,
  Send,
  Webhook,
  type LucideIcon,
} from 'lucide-react'
import {
  ApiError,
  getStats,
  listApiKeys,
  listDeliveries,
  listEndpoints,
  listEvents,
} from '@/api/client'
import type { Stats } from '@/api/types'
import { PageBanner } from '@/components/console/PageBanner'
import { ConsolePage } from '@/components/console/ConsolePage'
import { DataPanel } from '@/components/console/DataPanel'
import { DashboardQuickActions } from '@/components/console/DashboardQuickActions'
import { LiveChip } from '@/components/console/LiveChip'
import { LiveMetrics } from '@/components/console/LiveMetrics'
import { RecentActivity, type ActivityItem } from '@/components/console/RecentActivity'
import { Skeleton } from '@/components/ui/skeleton'
import { usePolling } from '@/hooks/usePolling'
import { formatPercent } from '@/lib/format'
import {
  buildOnboardingSteps,
  type OnboardingStep,
  type OnboardingStepId,
} from '@/lib/tenant-onboarding'
import { cn } from '@/lib/utils'

type ActivityPreview = ActivityItem

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function hasDashboardData(stats: Stats): boolean {
  return (
    stats.events_today > 0 ||
    stats.deliveries_active > 0 ||
    stats.deliveries_succeeded_24h > 0 ||
    stats.deliveries_failed_24h > 0
  )
}

type AttentionItem = {
  id: string
  label: string
  hint: string
  to: string
  tone: 'danger' | 'warning' | 'neutral'
  icon: LucideIcon
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<ActivityPreview[]>([])
  const [attention, setAttention] = useState<AttentionItem[]>([])
  const [onboarding, setOnboarding] = useState<OnboardingStep[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isInitial, setIsInitial] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toISOString())
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    try {
      const [data, disabled, eventsResult, deliveriesResult] = await Promise.all([
        getStats({ signal }),
        listEndpoints({ status: 'disabled', limit: 1 }, { signal }),
        listEvents({ limit: 5, offset: 0 }, { signal }),
        listDeliveries({ limit: 5, offset: 0 }, { signal }),
      ])

      let nextOnboarding: OnboardingStep[] | null = null
      if (!hasDashboardData(data)) {
        try {
          const [activeEndpoints, keys] = await Promise.all([
            listEndpoints({ status: 'active', limit: 1 }, { signal }),
            listApiKeys({ status: 'active', limit: 1 }, { signal }),
          ])
          nextOnboarding = buildOnboardingSteps({
            hasEndpoint: activeEndpoints.data.length > 0,
            hasApiKey: keys.data.length > 0,
            hasTestEvent: eventsResult.data.length > 0,
            hasDeliveries: deliveriesResult.data.length > 0,
          })
        } catch (err) {
          if (isAbortError(err)) throw err
          nextOnboarding = buildOnboardingSteps({
            hasEndpoint: false,
            hasApiKey: false,
            hasTestEvent: eventsResult.data.length > 0,
            hasDeliveries: deliveriesResult.data.length > 0,
          })
        }
      }

      if (signal.aborted) return

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

      setStats(data)
      setOnboarding(nextOnboarding)
      setAttention(buildAttentionItems(data, disabled.data.length))
      setActivity(merged)
      setLastUpdated(new Date().toISOString())
      setError(null)
      setIsLive(true)
    } catch (err) {
      if (isAbortError(err)) return
      setError(err instanceof ApiError ? err.message : 'Failed to load stats')
      setIsLive(false)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      if (!controller.signal.aborted) setIsInitial(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      abortRef.current?.abort()
    }
  }, [load])

  usePolling({
    enabled: (stats?.deliveries_active ?? 0) > 0,
    intervalMs: 10_000,
    onPoll: load,
  })

  const hasData = stats !== null && hasDashboardData(stats)

  return (
    <ConsolePage
      marker="Overview"
      title="Dashboard"
      description="Ingest volume, queue depth, and 24-hour delivery outcomes."
      actions={<LiveChip active={isLive} lastUpdated={lastUpdated} />}
    >
      {error ? (
        <PageBanner variant="error" title="Could not load stats" description={error} />
      ) : null}

      {isInitial && !stats ? (
        <DashboardSkeleton />
      ) : stats ? (
        <div className="dashboard-page">
          {!hasData && onboarding ? <EmptyDashboardCTA steps={onboarding} /> : null}

          {hasData && attention.length > 0 ? <AttentionStrip items={attention} /> : null}

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
            onRefresh={() => {
              void load()
            }}
          />
        </div>
      ) : null}
    </ConsolePage>
  )
}

function buildAttentionItems(stats: Stats, disabledCount: number): AttentionItem[] {
  const items: AttentionItem[] = []

  if (stats.deliveries_failed_24h > 0) {
    items.push({
      id: 'failed',
      label: `${stats.deliveries_failed_24h.toLocaleString()} failed (24h)`,
      hint: 'Open failed deliveries to replay',
      to: '/deliveries?status=failed',
      tone: 'danger',
      icon: AlertTriangle,
    })
  }

  if (stats.deliveries_active > 0) {
    items.push({
      id: 'active',
      label: `${stats.deliveries_active.toLocaleString()} active`,
      hint: 'Pending or in flight',
      to: '/deliveries?status=pending',
      tone: 'warning',
      icon: Send,
    })
  }

  if (disabledCount > 0) {
    items.push({
      id: 'disabled',
      label: `${disabledCount.toLocaleString()} disabled endpoint${disabledCount === 1 ? '' : 's'}`,
      hint: 'Not receiving webhooks',
      to: '/endpoints?status=disabled',
      tone: 'neutral',
      icon: PowerOff,
    })
  }

  return items
}

function AttentionStrip({ items }: { items: AttentionItem[] }) {
  const toneIconClass = {
    danger: 'dashboard-activity-row__icon--danger',
    warning: 'dashboard-activity-row__icon--warning',
    neutral: 'dashboard-activity-row__icon--neutral',
  } as const

  return (
    <DataPanel
      title="Needs attention"
      description="Failures, in-flight work, and disabled receivers — jump straight to the filtered list."
    >
      <div className="dashboard-activity-list">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.id} to={item.to} className="dashboard-activity-row group">
              <span
                className={cn('dashboard-activity-row__icon', toneIconClass[item.tone])}
                aria-hidden="true"
              >
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <div className="dashboard-activity-row__main">
                <p className="dashboard-activity-row__name">{item.label}</p>
                <p className="dashboard-panel-row__hint">{item.hint}</p>
              </div>
              <ChevronRight
                className="size-4 shrink-0 text-muted-strong/40 transition-colors duration-150 group-hover:text-primary"
                strokeWidth={2}
                aria-hidden="true"
              />
            </Link>
          )
        })}
      </div>
    </DataPanel>
  )
}

function OutcomesPanel({ stats }: { stats: Stats }) {
  const rows = [
    {
      label: 'Success rate',
      hint: 'Rolling 24-hour delivery success',
      value: formatPercent(stats.success_rate_24h, 'No data yet'),
      primary: true,
      to: null as string | null,
    },
    {
      label: 'Succeeded',
      hint: 'Completed deliveries',
      value: stats.deliveries_succeeded_24h.toLocaleString(),
      primary: false,
      to: '/deliveries?status=succeeded',
    },
    {
      label: 'Failed',
      hint: 'Exhausted retries or errors',
      value: stats.deliveries_failed_24h.toLocaleString(),
      primary: false,
      to: '/deliveries?status=failed',
    },
  ] as const

  return (
    <DataPanel title="24h outcomes">
      <div className="dashboard-activity-list">
        {rows.map((row) => {
          const content = (
            <>
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
            </>
          )

          if (row.to) {
            return (
              <Link key={row.label} to={row.to} className="dashboard-activity-row group">
                {content}
              </Link>
            )
          }

          return (
            <div key={row.label} className="dashboard-metric-row dashboard-metric-row--plain">
              {content}
            </div>
          )
        })}
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
    hint: 'Dev tools · non-prod smoke test',
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
          step.done ? 'dashboard-activity-row__icon--success' : onboardingToneIconClass[meta.tone],
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

function EmptyDashboardCTA({ steps }: { steps: OnboardingStep[] }) {
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
