import { ApiError, listEndpoints, sendEvent } from '@/api/client'
import type { IngestEventResponse } from '@/api/types'
import { ConsolePage } from '@/components/console/ConsolePage'
import { DataPanel } from '@/components/console/DataPanel'
import { DataPanelEmpty } from '@/components/console/DataPanelEmpty'
import { FormPanel } from '@/components/console/FormPanel'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { SendEventField } from '@/components/console/SendEventField'
import {
  SettingsCatalogList,
  SettingsCatalogRow,
  SettingsCopyValue,
} from '@/components/console/SettingsCatalog'
import { StatusBadge } from '@/components/console/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { IngestEventInput } from '@webhook/shared/zod'
import { ArrowRight, RefreshCw, RotateCcw, Send, Webhook } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'
import { Link } from 'react-router-dom'

const DEFAULT_PAYLOAD = `{
  "order_id": "123",
  "amount": 4999
}`

const PAYLOAD_LINE_COUNT = DEFAULT_PAYLOAD.split('\n').length

function createIdempotencyKey(): string {
  return crypto.randomUUID()
}

function parsePayloadJson(raw: string): IngestEventInput['payload'] | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as IngestEventInput['payload']
  } catch {
    return null
  }
}

function fieldDescribedBy(id: string, hasHint: boolean, hasError: boolean): string | undefined {
  const ids = [hasHint ? `${id}-hint` : null, hasError ? `${id}-error` : null].filter(Boolean)
  return ids.length > 0 ? ids.join(' ') : undefined
}

type EndpointGate =
  | { status: 'loading' }
  | { status: 'ready'; canSend: boolean }
  | { status: 'error'; message: string }

type EventFormState = {
  idempotencyKey: string
  type: string
  payloadText: string
  payloadError: string | null
  submitError: string | null
  submitting: boolean
  result: IngestEventResponse | null
}

type EventFormAction = { type: 'update'; changes: Partial<EventFormState> } | { type: 'reset' }

function createInitialFormState(): EventFormState {
  return {
    idempotencyKey: createIdempotencyKey(),
    type: 'order.paid',
    payloadText: DEFAULT_PAYLOAD,
    payloadError: null,
    submitError: null,
    submitting: false,
    result: null,
  }
}

function eventFormReducer(state: EventFormState, action: EventFormAction): EventFormState {
  return action.type === 'reset' ? createInitialFormState() : { ...state, ...action.changes }
}

export function SendEvent() {
  const [gate, setGate] = useState<EndpointGate>({ status: 'loading' })
  const [form, dispatch] = useReducer(eventFormReducer, undefined, createInitialFormState)

  useEffect(() => {
    let cancelled = false
    listEndpoints({ status: 'active', limit: 1 })
      .then((result) => {
        if (!cancelled) {
          setGate({ status: 'ready', canSend: result.total > 0 })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setGate({
            status: 'error',
            message: err instanceof ApiError ? err.message : 'Failed to load endpoints',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

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
      title="Test event"
      description="Console smoke test for this tenant. Production traffic should use POST /v1/events with an API key."
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

      {gate.status === 'ready' && !gate.canSend ? (
        <DataPanel
          emptyFlush
          empty={
            <DataPanelEmpty
              icon={Webhook}
              title="Create an endpoint first"
              description={
                <>
                  Ingest can succeed with zero deliveries if nothing is listening.{' '}
                  <Link to="/endpoints" className="font-medium text-primary hover:underline">
                    Create an endpoint
                  </Link>
                  , then come back to smoke-test.
                </>
              }
            />
          }
        >
          {null}
        </DataPanel>
      ) : null}

      {gate.status === 'ready' && gate.canSend ? (
        <>
          {form.result ? (
            <DataPanel
              title="Accepted event"
              description="Open the event to see delivery fan-out and outcomes."
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
              <SettingsCatalogList>
                <SettingsCatalogRow label="Status">
                  <StatusBadge kind="event" status={form.result.status} />
                </SettingsCatalogRow>
                <SettingsCatalogRow label="Event ID" layout="stacked">
                  <SettingsCopyValue
                    value={form.result.id}
                    copyLabel="Event ID"
                    buttonLabel="Copy"
                  />
                </SettingsCatalogRow>
                <SettingsCatalogRow label="Created">
                  <span className="text-sm text-ink">{formatDateTime(form.result.created_at)}</span>
                </SettingsCatalogRow>
              </SettingsCatalogList>
            </DataPanel>
          ) : null}

          <SendEventForm form={form} dispatch={dispatch} onSubmit={handleSubmit} />
        </>
      ) : null}
    </ConsolePage>
  )
}

function SendEventForm({
  form,
  dispatch,
  onSubmit,
}: {
  form: EventFormState
  dispatch: React.Dispatch<EventFormAction>
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <FormPanel
      title="Compose test event"
      titleVariant="prominent"
      description={
        <>
          Smoke-test request body for{' '}
          <code className="send-event-api-endpoint">POST /v1/events</code>. For real traffic, create
          an API key and use curl — see{' '}
          <Link to="/docs#ingest" className="font-medium text-primary hover:underline">
            ingest docs
          </Link>
          . The API responds with <strong className="font-medium text-ink">202 Accepted</strong>;
          deliveries queue immediately.
        </>
      }
      footerAlign="between"
      footer={
        <>
          <p className="send-event-footer-note">
            After send, track outcomes on{' '}
            <Link to="/deliveries" className="font-medium text-primary hover:underline">
              Deliveries
            </Link>
            .
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              type="submit"
              form="send-event-form"
              disabled={form.submitting}
              className="sm-btn-split"
            >
              <span className="sm-btn-split-label">
                {form.submitting ? 'Sending…' : 'Send test event'}
              </span>
              <span className="sm-btn-split-icon">
                <Send className="size-3.5" aria-hidden="true" />
              </span>
            </Button>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => dispatch({ type: 'reset' })}
              disabled={form.submitting}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" /> Reset form
            </Button>
          </div>
        </>
      }
    >
      <form id="send-event-form" className="send-event-form" onSubmit={onSubmit}>
        <fieldset className="m-0 border-0 p-0" disabled={form.submitting}>
          <legend className="sr-only">Test event</legend>
          {form.submitError ? (
            <div className="send-event-form-error" role="alert">
              <p className="send-event-form-error__title">Could not send event</p>
              <p className="send-event-form-error__desc">{form.submitError}</p>
            </div>
          ) : null}
          <div className="send-event-fields">
            <SendEventField
              id="idempotency-key"
              variant="plain"
              label="Idempotency key"
              hint="Auto-generated UUID. Reusing the same key returns the original event without creating new deliveries."
              action={
                <Button
                  type="button"
                  variant="secondary"
                  className="send-event-field__head-btn"
                  onClick={() =>
                    dispatch({
                      type: 'update',
                      changes: { idempotencyKey: createIdempotencyKey(), submitError: null },
                    })
                  }
                >
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  New UUID
                </Button>
              }
            >
              <div className="send-event-id-strip">
                <Input
                  id="idempotency-key"
                  value={form.idempotencyKey}
                  onChange={(event) =>
                    dispatch({
                      type: 'update',
                      changes: { idempotencyKey: event.target.value, submitError: null },
                    })
                  }
                  placeholder="e.g. 12a91c57-8f3a-4b2c-9d1e-6f7a8b9c0d1e"
                  className="send-event-plain-input send-event-plain-input--mono"
                  maxLength={256}
                  required
                  aria-describedby={fieldDescribedBy('idempotency-key', true, false)}
                />
              </div>
            </SendEventField>
            <SendEventField
              id="event-type"
              variant="plain"
              label="Event type"
              hint="Dot-separated name, e.g. order.paid or user.created."
            >
              <Input
                id="event-type"
                value={form.type}
                onChange={(event) =>
                  dispatch({
                    type: 'update',
                    changes: { type: event.target.value, submitError: null },
                  })
                }
                placeholder="order.paid"
                className="send-event-plain-input send-event-plain-input--bordered"
                maxLength={128}
                required
                aria-describedby={fieldDescribedBy('event-type', true, false)}
              />
            </SendEventField>
            <SendEventField
              id="event-payload"
              label="Payload"
              meta="JSON object · max 256 KiB"
              error={form.payloadError}
            >
              <Textarea
                id="event-payload"
                value={form.payloadText}
                onChange={(event) =>
                  dispatch({
                    type: 'update',
                    changes: {
                      payloadText: event.target.value,
                      payloadError: null,
                      submitError: null,
                    },
                  })
                }
                rows={PAYLOAD_LINE_COUNT}
                className="send-event-control-editor"
                spellCheck={false}
                required
                aria-invalid={form.payloadError !== null}
                aria-describedby={fieldDescribedBy(
                  'event-payload',
                  false,
                  form.payloadError !== null,
                )}
              />
            </SendEventField>
          </div>
        </fieldset>
      </form>
    </FormPanel>
  )
}
