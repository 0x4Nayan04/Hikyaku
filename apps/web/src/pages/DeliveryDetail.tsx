import { useCallback, useEffect, useReducer } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { ApiError, getDelivery, replayDelivery } from '@/api/client'
import type { DeliveryAttempt, DeliveryDetail as DeliveryDetailType } from '@/api/types'
import { ConsolePage } from '@/components/console/ConsolePage'
import { FormPanel } from '@/components/console/FormPanel'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { StatusBadge } from '@/components/console/StatusBadge'
import { LiveConnectionPill } from '@/components/layout/LiveConnectionPill'
import { CatalogButton } from '@/components/catalog/CatalogButton'
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
        <div className="text-right text-sm">
          <p className="font-medium text-foreground">
            {attempt.http_status !== null ? `HTTP ${attempt.http_status}` : 'No response'}
          </p>
          {attempt.duration_ms !== null ? (
            <p className="text-xs text-muted-foreground">{attempt.duration_ms} ms</p>
          ) : null}
        </div>
      </div>

      {attempt.error ? <p className="mt-3 text-sm text-destructive">{attempt.error}</p> : null}

      {attempt.response_body ? (
        <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-xs text-foreground">
          {attempt.response_body}
        </pre>
      ) : null}
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
          : 'Inspect attempt history and replay failed deliveries.'
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <LiveConnectionPill mode={mode} />
          <CatalogButton variant="secondary" asChild className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]">
            <Link to="/deliveries">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to deliveries
            </Link>
          </CatalogButton>
          {delivery?.status === 'failed' ? (
            <CatalogButton
              className="sm-btn-split h-[2.125rem] min-h-0"
              onClick={() => replayDispatch({ type: 'set_replay_open', open: true })}
            >
              <span className="sm-btn-split-label text-[0.8125rem]">Replay</span>
              <span className="sm-btn-split-icon" style={{ width: '2.125rem', minWidth: '2.125rem' }}>
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
          <FormPanel title="Delivery overview">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-muted-strong uppercase tracking-wider">Status</p>
                <div className="mt-2">
                  <StatusBadge kind="delivery" status={delivery.status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-strong uppercase tracking-wider">Attempts</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  {delivery.attempt_count}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-strong uppercase tracking-wider">Event</p>
                <Link
                  to={`/events/${delivery.event_id}`}
                  className="mt-1 block break-all font-mono text-xs text-primary hover:underline"
                >
                  {delivery.event_id}
                </Link>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-strong uppercase tracking-wider">Endpoint</p>
                <p className="mt-1 break-all font-mono text-xs text-foreground">
                  {delivery.endpoint_id}
                </p>
              </div>
            </div>

            {delivery.last_error ? (
              <PageBanner
                variant="error"
                title="Last error"
                description={delivery.last_error}
                className="mt-5"
              />
            ) : null}

            {delivery.next_retry_at ? (
              <p className="mt-4 text-sm text-muted-strong">
                Next retry scheduled for {formatDateTime(delivery.next_retry_at)}
              </p>
            ) : null}
          </FormPanel>

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
            <CatalogButton
              variant="secondary"
              onClick={() => replayDispatch({ type: 'set_replay_open', open: false })}
              disabled={replaying}
            >
              Cancel
            </CatalogButton>
            <CatalogButton onClick={handleReplay} disabled={replaying}>
              {replaying ? 'Replaying…' : 'Confirm replay'}
            </CatalogButton>
          </CatalogDialogFooter>
        </CatalogDialogContent>
      </CatalogDialog>
    </ConsolePage>
  )
}
