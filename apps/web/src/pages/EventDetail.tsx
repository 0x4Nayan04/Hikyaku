import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getEvent } from '@/api/client'
import type { EventDetail as EventDetailType } from '@/api/types'
import { ConsolePage } from '@/components/console/ConsolePage'
import { DataPanel } from '@/components/console/DataPanel'
import { DeliverySummary } from '@/components/console/DeliverySummary'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { StatusBadge } from '@/components/console/StatusBadge'
import {
  SettingsCatalogList,
  SettingsCatalogRow,
  SettingsCopyAction,
} from '@/components/console/SettingsCatalog'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'
import { useDetailFetch } from '@/hooks/useDetailFetch'
import { usePolling } from '@/hooks/usePolling'

function formatPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2)
}

export function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: event, loading, error, reload } = useDetailFetch<EventDetailType>({
    id,
    fetchDetail: getEvent,
    missingError: 'Event ID is missing',
    fallbackError: 'Failed to load event',
  })
  usePolling({ enabled: event?.status === 'pending', onPoll: reload })

  const payloadText = useMemo(() => (event ? formatPayload(event.payload) : ''), [event])

  return (
    <ConsolePage
      title={event?.type ?? 'Loading event…'}
      description={
        event
          ? `Ingested ${formatDateTime(event.created_at)}`
          : 'Payload and delivery outcomes for one event.'
      }
      actions={
        <Button size="sm" variant="secondary" asChild>
          <Link to="/events">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to events
          </Link>
        </Button>
      }
    >
      {error ? (
        <PageBanner variant="error" title="Could not load event" description={error} />
      ) : null}

      {loading ? (
        <PageLoading variant="detail-metrics" />
      ) : event ? (
        <div className="flex flex-col gap-6">
          <DataPanel title="Event overview">
            <SettingsCatalogList className="settings-catalog-list--compact">
              <SettingsCatalogRow label="Status">
                <StatusBadge kind="event" status={event.status} />
              </SettingsCatalogRow>
              <SettingsCatalogRow label="Type">
                <span className="text-sm font-medium text-ink">{event.type}</span>
              </SettingsCatalogRow>
              <SettingsCatalogRow label="Created">
                <span className="text-sm text-ink">{formatDateTime(event.created_at)}</span>
              </SettingsCatalogRow>
              <SettingsCatalogRow
                label="Idempotency key"
                action={
                  <SettingsCopyAction value={event.idempotency_key} copyLabel="Idempotency key" />
                }
              >
                <code
                  className="min-w-0 truncate font-mono text-xs text-ink"
                  title={event.idempotency_key}
                >
                  {event.idempotency_key}
                </code>
              </SettingsCatalogRow>
              <SettingsCatalogRow
                label="Event ID"
                action={<SettingsCopyAction value={event.id} copyLabel="Event ID" />}
              >
                <code className="min-w-0 truncate font-mono text-xs text-ink" title={event.id}>
                  {event.id}
                </code>
              </SettingsCatalogRow>
            </SettingsCatalogList>
          </DataPanel>

          <DataPanel
            title="Delivery summary"
            footer={
              event.deliveries_summary.total > 0 ? (
                <div className="px-4 py-3 md:px-5">
                  <Link
                    to={`/deliveries?event_id=${encodeURIComponent(event.id)}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View deliveries for this event
                  </Link>
                </div>
              ) : undefined
            }
          >
            <DeliverySummary summary={event.deliveries_summary} />
          </DataPanel>

          <DataPanel
            title="Payload"
            actions={<SettingsCopyAction value={payloadText} copyLabel="Payload" />}
          >
            <div className="p-4 md:p-5">
              <pre className="event-detail-payload">{payloadText}</pre>
            </div>
          </DataPanel>
        </div>
      ) : null}
    </ConsolePage>
  )
}
