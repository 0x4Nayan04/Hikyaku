import { isWorkspaceActionAvailable, SEND_EVENT_ACTION } from '@/lib/workspace-actions'
import { usePageCache } from '@/providers/page-cache-context'
import { useReadOnlyWorkspace } from '@/providers/session-context'
import { Navigate } from 'react-router-dom'
import { ApiError, sendEvent } from '@/api/client'
import type { EventStatus } from '@/api/types'
import { ConsolePage } from '@/components/console/chrome/ConsolePage'
import { DataPanel } from '@/components/console/catalogs/DataPanel'
import { DataPanelEmpty } from '@/components/console/catalogs/DataPanelEmpty'
import { PageBanner } from '@/components/console/chrome/PageBanner'
import { PageLoading } from '@/components/console/chrome/PageLoading'
import {
  DetailFieldList,
  DetailFieldRow,
  CopyValue,
} from '@/components/console/details/DetailFields'
import { StatusBadge } from '@/components/console/catalogs/StatusBadge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import { SendEventForm } from '@/pages/events/SendEventForm'
import {
  createInitialFormState,
  eventFormReducer,
  parsePayloadJson,
} from '@/pages/events/sendEventFormState'
import { useAcceptedEventStatus } from '@/pages/events/useAcceptedEventStatus'
import { useEndpointGate } from '@/pages/events/useEndpointGate'
import { ArrowRight, PowerOff, RefreshCw, Webhook } from 'lucide-react'
import { useCallback, useReducer } from 'react'
import { Link } from 'react-router-dom'

export default function SendEvent() {
  return isWorkspaceActionAvailable(SEND_EVENT_ACTION, useReadOnlyWorkspace()) ? (
    <SendEventPage />
  ) : (
    <Navigate to="/events" replace />
  )
}

function SendEventPage() {
  const pageCache = usePageCache()
  const gate = useEndpointGate()
  const [form, dispatch] = useReducer(eventFormReducer, undefined, createInitialFormState)
  const onAcceptedStatus = useCallback((id: string, status: EventStatus) => {
    dispatch({ type: 'status', id, status })
  }, [])
  const { statusError } = useAcceptedEventStatus(form.result, onAcceptedStatus)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatch({ type: 'update', changes: { submitError: null, payloadError: null, result: null } })

    const payload = parsePayloadJson(form.payloadText)
    if (!payload) {
      dispatch({
        type: 'update',
        changes: { payloadError: 'Enter a valid JSON object (not an array or primitive).' },
      })
      return
    }

    dispatch({ type: 'update', changes: { submitting: true } })

    try {
      const response = await sendEvent({
        idempotency_key: form.idempotencyKey.trim(),
        type: form.type.trim(),
        payload,
      })
      pageCache?.clear()
      dispatch({ type: 'update', changes: { result: response } })
      toast.success('Event accepted')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to send event'
      dispatch({ type: 'update', changes: { submitError: message } })
      toast.error(message)
    } finally {
      dispatch({ type: 'update', changes: { submitting: false } })
    }
  }

  return (
    <ConsolePage
      marker="Dev tools"
      title="Test event"
      description={
        <>
          Sends a real webhook to the active endpoints.{' '}
          <Link to="/docs#ingest" className="font-medium text-primary hover:underline">
            Ingest docs
          </Link>
          {' · '}
          <Link to="/docs#api-only-path" className="font-medium text-primary hover:underline">
            Terminal walkthrough
          </Link>
        </>
      }
      actions={
        <Button size="sm" className="sm-btn-split" variant="secondary" asChild>
          <Link to="/events">
            <span className="sm-btn-split-label">View events</span>
            <span className="sm-btn-split-icon">
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          </Link>
        </Button>
      }
    >
      {gate.status === 'error' ? (
        <PageBanner variant="error" title="Could not check endpoints" description={gate.message} />
      ) : null}

      {gate.status === 'loading' ? <PageLoading variant="detail" /> : null}

      {gate.status === 'ready' && gate.canSend === false ? (
        <DataPanel emptyFlush empty={endpointGateEmpty(gate.reason)}>
          {null}
        </DataPanel>
      ) : null}

      {gate.status === 'ready' && gate.canSend ? (
        <>
          {statusError ? (
            <PageBanner
              variant="error"
              title="Could not update event status"
              description={`${statusError}. Status will retry automatically.`}
            />
          ) : null}
          {form.result ? (
            <DataPanel
              title="Accepted event"
              description="Status updates while deliveries are still open. Open the event for fan-out and attempts."
              footer={
                <div className="flex w-full flex-wrap items-center justify-end gap-3 px-4 py-3 md:px-5">
                  <Button size="sm" variant="secondary" onClick={() => dispatch({ type: 'reset' })}>
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    Send another
                  </Button>
                  <Button size="sm" className="sm-btn-split" asChild>
                    <Link to={`/events/${form.result.id}`}>
                      <span className="sm-btn-split-label">View event</span>
                      <span className="sm-btn-split-icon">
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </span>
                    </Link>
                  </Button>
                </div>
              }
            >
              <DetailFieldList>
                <DetailFieldRow label="Status">
                  <StatusBadge kind="event" status={form.result.status} />
                </DetailFieldRow>
                <DetailFieldRow label="Event ID" layout="stacked">
                  <CopyValue value={form.result.id} copyLabel="Event ID" buttonLabel="Copy" />
                </DetailFieldRow>
                <DetailFieldRow label="Created">
                  <span className="text-sm text-ink">{formatDateTime(form.result.created_at)}</span>
                </DetailFieldRow>
              </DetailFieldList>
            </DataPanel>
          ) : null}

          <SendEventForm form={form} dispatch={dispatch} onSubmit={handleSubmit} />
        </>
      ) : null}
    </ConsolePage>
  )
}

function endpointGateEmpty(reason: 'none' | 'all_disabled') {
  switch (reason) {
    case 'none':
      return (
        <DataPanelEmpty
          icon={Webhook}
          title="Create an endpoint first"
          description={
            <>
              Ingest can succeed with zero deliveries if nothing is listening.{' '}
              <Link to="/endpoints" className="font-medium text-primary hover:underline">
                Create an endpoint
              </Link>
              , then send your test event.
            </>
          }
        />
      )
    case 'all_disabled':
      return (
        <DataPanelEmpty
          icon={PowerOff}
          title="Enable an endpoint"
          description={
            <>
              Disabled endpoints are not receiving webhooks.{' '}
              <Link to="/endpoints" className="font-medium text-primary hover:underline">
                Enable an endpoint
              </Link>
              , then send your test event.
            </>
          }
        />
      )
    default: {
      const unreachable: never = reason
      return unreachable
    }
  }
}
