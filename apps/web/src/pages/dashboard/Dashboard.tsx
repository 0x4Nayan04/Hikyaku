import { usePageCache } from '@/providers/page-cache-context'
import type { DashboardSnapshot } from '@/lib/page-cache'
import { useReadOnlyWorkspace } from '@/providers/session-context'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, ChevronRight, PowerOff, Send, type LucideIcon } from 'lucide-react'
import type { Stats } from '@/api/types'
import { PageBanner } from '@/components/console/chrome/PageBanner'
import { ConsolePage } from '@/components/console/chrome/ConsolePage'
import { DataPanel } from '@/components/console/catalogs/DataPanel'
import { DashboardQuickActions } from '@/pages/dashboard/DashboardQuickActions'
import { LiveChip } from '@/components/console/metrics/LiveChip'
import { LiveMetrics } from '@/components/console/metrics/LiveMetrics'
import { RecentActivity, type ActivityItem } from '@/components/console/metrics/RecentActivity'
import { Skeleton } from '@/components/ui/skeleton'
import { hasDashboardData, useDashboardSnapshot } from '@/hooks/useDashboardSnapshot'
import { PRODUCT_LINKS } from '@/lib/meta/app-meta'
import { formatPercent, formatStatusLabel } from '@/lib/format'
import { type OnboardingStep, type OnboardingStepId } from '@/lib/auth/tenant-onboarding'
import { POLL_DEFAULT_MS } from '@/lib/ui-timing'
import { cn } from '@/lib/utils'

function buildActivity(
  events: DashboardSnapshot['events'],
  deliveries: DashboardSnapshot['deliveries'],
): ActivityItem[] {
  return [
    ...events.map((event) => ({
      id: `event-${event.id}`,
      kind: 'event' as const,
      eventType: event.type,
      status: event.status,
      to: `/events/${event.id}`,
      createdAt: event.created_at,
    })),
    ...deliveries.map((delivery) => ({
      id: `delivery-${delivery.id}`,
      kind: 'delivery' as const,
      eventType: `Delivery ${formatStatusLabel(delivery.status)}`,
      status: delivery.status,
      to: `/deliveries/${delivery.id}`,
      createdAt: delivery.created_at,
      attemptCount: delivery.attempt_count,
      replayCount: delivery.replay_count,
    })),
  ]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5)
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
  const cache = usePageCache()
  return <DashboardContent key={cache?.dashboard.id ?? 'uncached'} />
}

function DashboardContent() {
  const readOnly = useReadOnlyWorkspace()
  const { snapshot, error, isInitial, isLive, isRefreshing, load } = useDashboardSnapshot()
  const stats = snapshot?.stats ?? null
  const activity = buildActivity(snapshot?.events ?? [], snapshot?.deliveries ?? [])
  const attention = stats ? buildAttentionItems(stats, snapshot?.hasDisabledEndpoint ?? false) : []
  const onboarding = snapshot?.onboarding ?? null
  const onboardingError = snapshot?.onboardingError ?? null
  const lastUpdated = snapshot?.lastUpdated

  const hasData = stats !== null && hasDashboardData(stats)

  return (
    <ConsolePage
      marker="Overview"
      title="Dashboard"
      description="Events, in-flight deliveries, and 24-hour outcomes."
      actions={
        isRefreshing && snapshot ? (
          <span role="status" className="text-sm text-muted-foreground">
            Updating…
          </span>
        ) : (
          <LiveChip active={isLive} lastUpdated={lastUpdated} intervalMs={POLL_DEFAULT_MS} />
        )
      }
    >
      {error ? (
        <PageBanner variant="error" title="Could not load stats" description={error} />
      ) : null}

      {onboardingError ? (
        <PageBanner
          variant="error"
          title="Could not check endpoints"
          description={onboardingError}
        />
      ) : null}

      {isInitial && !stats ? (
        <DashboardSkeleton />
      ) : stats ? (
        <div className="dashboard-page">
          {!readOnly && !hasData && onboarding?.some((step) => !step.done) ? (
            <EmptyDashboardCTA steps={onboarding} />
          ) : null}

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

export default Dashboard

function buildAttentionItems(stats: Stats, hasDisabledEndpoints: boolean): AttentionItem[] {
  const items: AttentionItem[] = []

  if (stats.deliveries_failed_24h > 0) {
    items.push({
      id: 'failed',
      label: `${stats.deliveries_failed_24h.toLocaleString()} failed (24h)`,
      hint: 'Open failed deliveries to replay',
      to: '/deliveries?status=failed&updated_within=24h',
      tone: 'danger',
      icon: AlertTriangle,
    })
  }

  if (stats.deliveries_active > 0) {
    items.push({
      id: 'active',
      label: `${stats.deliveries_active.toLocaleString()} active`,
      hint: 'Pending or in flight',
      to: '/deliveries?status=open',
      tone: 'warning',
      icon: Send,
    })
  }

  if (hasDisabledEndpoints) {
    items.push({
      id: 'disabled',
      label: 'Disabled endpoints present',
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
    <DataPanel title="Needs attention" description="Failed, in-flight, or disabled receivers.">
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
      hint: 'Final deliveries, last 24 hours',
      value: formatPercent(stats.success_rate_24h, 'No data yet'),
      primary: true,
      to: null,
    },
    {
      label: 'Succeeded',
      hint: 'Succeeded in the last 24 hours',
      value: stats.deliveries_succeeded_24h.toLocaleString(),
      primary: false,
      to: '/deliveries?status=succeeded&updated_within=24h',
    },
    {
      label: 'Failed',
      hint: 'Failed in the last 24 hours',
      value: stats.deliveries_failed_24h.toLocaleString(),
      primary: false,
      to: '/deliveries?status=failed&updated_within=24h',
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

const onboardingStepMeta: Record<OnboardingStepId, { hint: string }> = {
  endpoint: { hint: 'Receiver URL and signing secret' },
  test_event: { hint: 'Send a real test webhook' },
  deliveries: { hint: 'Outbound delivery attempts' },
}

function OnboardingStepRow({ step, index }: { step: OnboardingStep; index: number }) {
  const meta = onboardingStepMeta[step.id]

  const rowContent = (
    <>
      <span
        className={cn(
          'dashboard-onboarding-index',
          step.done && 'dashboard-onboarding-index--done',
        )}
        aria-hidden="true"
      >
        {step.done ? (
          <Check className="size-3.5" strokeWidth={2.25} />
        ) : (
          String(index + 1).padStart(2, '0')
        )}
      </span>
      <div className="dashboard-activity-row__main">
        <p className={cn('dashboard-activity-row__name', step.done && 'text-muted-strong')}>
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
      description={
        <>
          Add a receiver, send a test event, then watch deliveries.{' '}
          <a
            href={`${PRODUCT_LINKS.docs}#api-only-path`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Terminal walkthrough
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </>
      }
    >
      <div className="dashboard-activity-list">
        {steps.map((step, index) => (
          <OnboardingStepRow key={step.id} step={step} index={index} />
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
