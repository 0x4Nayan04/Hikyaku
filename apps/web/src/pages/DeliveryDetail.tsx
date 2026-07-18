import { useCallback, useEffect, useReducer } from 'react'
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
import { LiveConnectionPill } from '@/components/layout/LiveConnectionPill'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import { CatalogChip, type CatalogChipTone } from '@/components/catalog/CatalogChip'
import {
  CatalogDialog,
  CatalogDialogContent,
  CatalogDialogDescription,
  CatalogDialogFooter,
  CatalogDialogHeader,
  CatalogDialogTitle,
} from '@/components/catalog/CatalogDialog'

import { useDeliveryLiveUpdates } from '@/hooks/useDeliveryLiveUpdates'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'

function httpStatusTone(status: number): CatalogChipTone {
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
            <CatalogChip variant="status" tone={httpStatusTone(attempt.http_status)}>
              HTTP {attempt.http_status}
            </CatalogChip>
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

type DeliveryLoadState = {
  delivery: DeliveryDetailType | null
  loading: boolean
  error: string | null
}

type DeliveryLoadAction =
  | { type: 'load_start' }
  | { type: 'success'; delivery: DeliveryDetailType }
  | { type: 'failure'; error: string }
  | { type: 'load_end' }
  | { type: 'missing_id' }

function deliveryLoadReducer(
  state: DeliveryLoadState,
  action: DeliveryLoadAction,
): DeliveryLoadState {
  switch (action.type) {
    case 'load_start':
      return { ...state, loading: true }
    case 'success':
      return { ...state, delivery: action.delivery, error: null }
    case 'failure':
      return { ...state, error: action.error }
    case 'load_end':
      return { ...state, loading: false }
    case 'missing_id':
      return { delivery: null, error: 'Delivery ID is missing', loading: false }
    default: {
      action satisfies never
      return state
    }
  }
}

type ReplayDialogState = {
  replayOpen: boolean
  replaying: boolean
}

type ReplayDialogAction =
  | { type: 'set_replay_open'; open: boolean }
  | { type: 'replay_start' }
  | { type: 'replay_success' }
  | { type: 'replay_end' }

const initialReplayDialogState: ReplayDialogState = {
  replayOpen: false,
  replaying: false,
}

function replayDialogReducer(
  state: ReplayDialogState,
  action: ReplayDialogAction,
): ReplayDialogState {
  switch (action.type) {
    case 'set_replay_open':
      return { ...state, replayOpen: action.open }
    case 'replay_start':
      return { ...state, replaying: true }
    case 'replay_success':
      return { replayOpen: false, replaying: false }
    case 'replay_end':
      return { ...state, replaying: false }
    default: {
      action satisfies never
      return state
    }
  }
}

export function DeliveryDetail() {
  const { id } = useParams<{ id: string }>()
  const [{ delivery, loading, error }, loadDispatch] = useReducer(deliveryLoadReducer, {
    delivery: null,
    loading: true,
    error: null,
  })
  const [replayState, replayDispatch] = useReducer(replayDialogReducer, initialReplayDialogState)
  const { replayOpen, replaying } = replayState

  const loadDelivery = useCallback(
    async (showLoading = false) => {
      if (!id) {
        loadDispatch({ type: 'missing_id' })
        return
      }

      if (showLoading) {
        loadDispatch({ type: 'load_start' })
      }

      try {
        const data = await getDelivery(id)
        loadDispatch({ type: 'success', delivery: data })
      } catch (err) {
        loadDispatch({
          type: 'failure',
          error: err instanceof ApiError ? err.message : 'Failed to load delivery',
        })
      } finally {
        if (showLoading) {
          loadDispatch({ type: 'load_end' })
        }
      }
    },
    [id],
  )

  useEffect(() => {
    void loadDelivery(true)
  }, [loadDelivery])

  const { mode } = useDeliveryLiveUpdates({
    enabled: Boolean(id),
    onDeliveryUpdated: (updated) => {
      if (updated.id !== id) {
        return
      }
      void loadDelivery()
    },
    onPoll: () => {
      void loadDelivery()
    },
  })

  async function handleReplay() {
    if (!id) {
      return
    }

    replayDispatch({ type: 'replay_start' })

    try {
      await replayDelivery(id)
      replayDispatch({ type: 'replay_success' })
      toast.success('Delivery replay queued')
      await loadDelivery()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to replay delivery')
      replayDispatch({ type: 'replay_end' })
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
          <LiveConnectionPill mode={mode} />
          <CatalogButton size="sm" variant="secondary" asChild>
            <Link to="/deliveries">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to deliveries
            </Link>
          </CatalogButton>
          {delivery?.status === 'failed' ? (
            <CatalogButton size="sm" className="sm-btn-split"
              onClick={() => replayDispatch({ type: 'set_replay_open', open: true })}
            >
              <span className="sm-btn-split-label">Replay</span>
              <span className="sm-btn-split-icon">
                <RotateCcw className="size-3.5" aria-hidden="true" />
              </span>
            </CatalogButton>
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
                action={<SettingsCopyAction value={delivery.endpoint_url} copyLabel="Endpoint URL" />}
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
                  description={delivery.last_error}
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

      <CatalogDialog
        open={replayOpen}
        onOpenChange={(open) => replayDispatch({ type: 'set_replay_open', open })}
      >
        <CatalogDialogContent className="sm:max-w-md">
          <CatalogDialogHeader>
            <CatalogDialogTitle>Replay delivery</CatalogDialogTitle>
            <CatalogDialogDescription className="text-muted-foreground">
              This resets the delivery to pending, clears the terminal error, and re-enqueues a new
              worker job.
            </CatalogDialogDescription>
          </CatalogDialogHeader>
          <CatalogDialogFooter>
            <CatalogButton size="sm"
              variant="secondary"
              onClick={() => replayDispatch({ type: 'set_replay_open', open: false })}
              disabled={replaying}
            >
              Cancel
            </CatalogButton>
            <CatalogButton size="sm" onClick={handleReplay} disabled={replaying}>
              {replaying ? 'Replaying…' : 'Confirm replay'}
            </CatalogButton>
          </CatalogDialogFooter>
        </CatalogDialogContent>
      </CatalogDialog>
    </ConsolePage>
  )
}
