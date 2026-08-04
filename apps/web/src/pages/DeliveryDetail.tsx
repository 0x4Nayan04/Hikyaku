import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { ApiError, getDelivery, replayDelivery } from '@/api/client'
import type { DeliveryAttempt, DeliveryDetail as DeliveryDetailType } from '@/api/types'
import { AttemptResponseBody } from '@/components/console/AttemptResponseBody'
import { ConsolePage } from '@/components/console/ConsolePage'
import { DataPanel } from '@/components/console/DataPanel'
import { FormPanel } from '@/components/console/FormPanel'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import {
  SettingsCatalogList,
  SettingsCatalogRow,
  SettingsCopyAction,
} from '@/components/console/SettingsCatalog'
import { StatusBadge } from '@/components/console/StatusBadge'
import { LiveChip } from '@/components/console/LiveChip'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { usePolling } from '@/hooks/usePolling'
import { formatDateTime, formatDeliveryError } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { useDetailFetch } from '@/hooks/useDetailFetch'

function httpStatusTone(status: number): BadgeTone {
  if (status >= 500) return 'danger'
  if (status >= 400) return 'warning'
  if (status >= 200 && status < 300) return 'success'
  return 'neutral'
}

function AttemptTimelineItem({ attempt }: { attempt: DeliveryAttempt }) {
  const isError = attempt.error || (attempt.http_status !== null && attempt.http_status >= 400)

  return (
    <div
      className={cn(
        'card-ring p-5',
        isError && 'border-l-2 border-l-status-danger-border bg-status-danger-subtle/30',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Attempt {attempt.attempt_number}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(attempt.created_at)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {attempt.http_status !== null ? (
            <Badge variant="status" tone={httpStatusTone(attempt.http_status)}>
              HTTP {attempt.http_status}
            </Badge>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">No response</p>
          )}
          {attempt.duration_ms !== null ? (
            <p className="text-xs text-muted-foreground">{attempt.duration_ms} ms</p>
          ) : null}
        </div>
      </div>

      {attempt.error ? <p className="mt-3 text-sm text-destructive">{attempt.error}</p> : null}

      {attempt.response_body ? <AttemptResponseBody body={attempt.response_body} /> : null}
    </div>
  )
}

export function DeliveryDetail() {
  const { id } = useParams<{ id: string }>()
  const [replayOpen, setReplayOpen] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const { data: delivery, loading, error, reload } = useDetailFetch<DeliveryDetailType>({
    id,
    fetchDetail: getDelivery,
    missingError: 'Delivery ID is missing',
    fallbackError: 'Failed to load delivery',
  })
  usePolling({
    enabled: Boolean(id),
    onPoll: () => {
      void reload()
    },
  })

  async function handleReplay() {
    if (!id) {
      return
    }

    setReplaying(true)

    try {
      await replayDelivery(id)
      setReplayOpen(false)
      setReplaying(false)
      toast.success('Delivery replay queued')
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to replay delivery')
      setReplaying(false)
    }
  }

  return (
    <ConsolePage
      title={delivery ? `Delivery ${delivery.id.slice(0, 8)}…` : 'Loading delivery…'}
      description={
        delivery
          ? `Last updated ${formatDateTime(delivery.updated_at)} · ${delivery.attempt_count} attempt(s)`
          : 'Attempt history and replay for one delivery.'
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <LiveChip active={error === null} />
          <Button size="sm" variant="secondary" asChild>
            <Link to="/deliveries">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to deliveries
            </Link>
          </Button>
          {delivery?.status === 'failed' ? (
            <Button size="sm" className="sm-btn-split" onClick={() => setReplayOpen(true)}>
              <span className="sm-btn-split-label">Replay</span>
              <span className="sm-btn-split-icon">
                <RotateCcw className="size-3.5" aria-hidden="true" />
              </span>
            </Button>
          ) : null}
        </div>
      }
    >
      {error ? (
        <PageBanner variant="error" title="Could not load delivery" description={error} />
      ) : null}

      {loading ? (
        <PageLoading variant="detail" />
      ) : delivery ? (
        <div className="flex flex-col gap-6">
          <DataPanel title="Delivery overview">
            <SettingsCatalogList className="settings-catalog-list--compact">
              <SettingsCatalogRow label="Status">
                <StatusBadge kind="delivery" status={delivery.status} />
              </SettingsCatalogRow>
              <SettingsCatalogRow label="Attempts">
                <span className="text-sm text-ink">
                  {delivery.attempt_count} attempt{delivery.attempt_count !== 1 ? 's' : ''}
                </span>
              </SettingsCatalogRow>
              <SettingsCatalogRow
                label="Event"
                action={<SettingsCopyAction value={delivery.event_id} copyLabel="Event ID" />}
              >
                <Link
                  to={`/events/${delivery.event_id}`}
                  className="min-w-0 truncate font-mono text-xs text-primary hover:underline"
                  title={delivery.event_id}
                >
                  {delivery.event_id}
                </Link>
              </SettingsCatalogRow>
              <SettingsCatalogRow
                label="Endpoint"
                action={
                  <SettingsCopyAction value={delivery.endpoint_url} copyLabel="Endpoint URL" />
                }
              >
                <code
                  className="min-w-0 truncate font-mono text-xs text-ink"
                  title={`${delivery.endpoint_url} (${delivery.endpoint_id})`}
                >
                  {delivery.endpoint_url}
                </code>
              </SettingsCatalogRow>
            </SettingsCatalogList>

            {delivery.last_error ? (
              <div className="border-t border-border/60 px-4 py-3 md:px-5">
                <PageBanner
                  variant="error"
                  title="Last error"
                  description={formatDeliveryError(delivery.last_error)}
                />
              </div>
            ) : null}

            {delivery.next_retry_at ? (
              <p className="border-t border-border/60 px-4 py-3 text-sm text-muted-strong md:px-5">
                Next retry scheduled for {formatDateTime(delivery.next_retry_at)}
              </p>
            ) : null}
          </DataPanel>

          <div>
            <p className="console-section-marker">Attempt timeline</p>
            {delivery.attempts.length === 0 ? (
              <FormPanel className="mt-3">
                <p className="text-sm text-muted-strong">No attempts recorded yet.</p>
              </FormPanel>
            ) : (
              <ol className="mt-3 flex flex-col gap-3">
                {delivery.attempts.map((attempt) => (
                  <li key={attempt.attempt_number}>
                    <AttemptTimelineItem attempt={attempt} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : null}

      <Dialog open={replayOpen} onOpenChange={setReplayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Replay delivery</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This resets the delivery to pending, clears prior attempt history and the terminal
              error, and re-enqueues a new worker job.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setReplayOpen(false)}
              disabled={replaying}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleReplay} disabled={replaying}>
              {replaying ? 'Replaying…' : 'Confirm replay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConsolePage>
  )
}
