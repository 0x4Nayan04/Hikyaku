import { useReducer } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, RefreshCw, RotateCcw, Send } from 'lucide-react'
import { toast } from '@/lib/toast'
import { ApiError, sendEvent } from '@/api/client'
import type { IngestEventResponse } from '@/api/types'
import { StatusBadge } from '@/components/console/StatusBadge'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import { CatalogInput } from '@/components/catalog/CatalogInput'
import { CatalogTextarea } from '@/components/catalog/CatalogTextarea'
import { ConsolePage } from '@/components/console/ConsolePage'
import { DataPanel } from '@/components/console/DataPanel'
import { FormPanel } from '@/components/console/FormPanel'
import { SendEventField } from '@/components/console/SendEventField'
import {
  SettingsCatalogList,
  SettingsCatalogRow,
  SettingsCopyValue,
} from '@/components/console/SettingsCatalog'
import { formatDateTime } from '@/lib/format'

const DEFAULT_PAYLOAD = `{
  "order_id": "123",
  "amount": 4999
}`

const PAYLOAD_LINE_COUNT = DEFAULT_PAYLOAD.split('\n').length

function createIdempotencyKey(): string {
  return crypto.randomUUID()
}

function parsePayloadJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function fieldDescribedBy(id: string, hasHint: boolean, hasError: boolean): string | undefined {
  const ids = [
    hasHint ? `${id}-hint` : null,
    hasError ? `${id}-error` : null,
  ].filter(Boolean)
  return ids.length > 0 ? ids.join(' ') : undefined
}

type SendEventState = {
  idempotencyKey: string
  type: string
  payloadText: string
  payloadError: string | null
  submitError: string | null
  submitting: boolean
  result: IngestEventResponse | null
}

type SendEventAction =
  | { type: 'set_idempotency_key'; value: string }
  | { type: 'set_type'; value: string }
  | { type: 'set_payload_text'; value: string }
  | { type: 'submit_prepare' }
  | { type: 'set_payload_error'; error: string }
  | { type: 'submit_start' }
  | { type: 'submit_success'; result: IngestEventResponse }
  | { type: 'submit_failure'; error: string }
  | { type: 'reset' }

const initialSendEventState: SendEventState = {
  idempotencyKey: createIdempotencyKey(),
  type: 'order.paid',
  payloadText: DEFAULT_PAYLOAD,
  payloadError: null,
  submitError: null,
  submitting: false,
  result: null,
}

function sendEventReducer(state: SendEventState, action: SendEventAction): SendEventState {
  switch (action.type) {
    case 'set_idempotency_key':
      return { ...state, idempotencyKey: action.value, submitError: null }
    case 'set_type':
      return { ...state, type: action.value, submitError: null }
    case 'set_payload_text':
      return { ...state, payloadText: action.value, payloadError: null, submitError: null }
    case 'submit_prepare':
      return { ...state, submitError: null, payloadError: null, result: null }
    case 'set_payload_error':
      return { ...state, payloadError: action.error }
    case 'submit_start':
      return { ...state, submitting: true }
    case 'submit_success':
      return { ...state, result: action.result, submitting: false }
    case 'submit_failure':
      return { ...state, submitError: action.error, submitting: false }
    case 'reset':
      return {
        idempotencyKey: createIdempotencyKey(),
        type: 'order.paid',
        payloadText: DEFAULT_PAYLOAD,
        payloadError: null,
        submitError: null,
        submitting: false,
        result: null,
      }
    default: {
      action satisfies never
      return state
    }
  }
}

export function SendEvent() {
  const [state, dispatch] = useReducer(sendEventReducer, initialSendEventState)
  const { idempotencyKey, type, payloadText, payloadError, submitError, submitting, result } = state

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatch({ type: 'submit_prepare' })

    const payload = parsePayloadJson(payloadText)
    if (!payload) {
      dispatch({ type: 'set_payload_error', error: 'Enter a valid JSON object (not an array or primitive).' })
      return
    }

    dispatch({ type: 'submit_start' })

    try {
      const response = await sendEvent({
        idempotency_key: idempotencyKey.trim(),
        type: type.trim(),
        payload,
      })
      dispatch({ type: 'submit_success', result: response })
      toast.success('Event accepted')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to send event'
      dispatch({ type: 'submit_failure', error: message })
      toast.error(message)
    }
  }

  function handleResetForm() {
    dispatch({ type: 'reset' })
  }

  function handleRegenerateKey() {
    dispatch({ type: 'set_idempotency_key', value: createIdempotencyKey() })
  }

  return (
    <ConsolePage
      title="Send event"
      description="Submit a test event to this tenant. The API returns 202 and deliveries run asynchronously."
      actions={
        <CatalogButton className="sm-btn-split h-[2.125rem] min-h-0" variant="secondary" asChild>
          <Link to="/events">
            <span className="sm-btn-split-label text-[0.8125rem]">View events</span>
            <span className="sm-btn-split-icon" style={{ width: '2.125rem', minWidth: '2.125rem' }}>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          </Link>
        </CatalogButton>
      }
    >
      {result ? (
        <DataPanel
          title="Accepted event"
          description="Deliveries are fanning out to active endpoints."
          footer={
            <div className="flex w-full flex-wrap items-center justify-end gap-3 px-4 py-3 md:px-5">
              <CatalogButton
                variant="secondary"
                onClick={handleResetForm}
                className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Send another
              </CatalogButton>
              <CatalogButton className="sm-btn-split h-[2.125rem] min-h-0" asChild>
                <Link to={`/events/${result.id}`}>
                  <span className="sm-btn-split-label text-[0.8125rem]">View event</span>
                  <span
                    className="sm-btn-split-icon"
                    style={{ width: '2.125rem', minWidth: '2.125rem' }}
                  >
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                </Link>
              </CatalogButton>
            </div>
          }
        >
          <SettingsCatalogList>
            <SettingsCatalogRow label="Status">
              <StatusBadge kind="event" status={result.status} />
            </SettingsCatalogRow>
            <SettingsCatalogRow label="Event ID" layout="stacked">
              <SettingsCopyValue value={result.id} copyLabel="Event ID" buttonLabel="Copy" />
            </SettingsCatalogRow>
            <SettingsCatalogRow label="Created">
              <span className="text-sm text-ink">{formatDateTime(result.created_at)}</span>
            </SettingsCatalogRow>
          </SettingsCatalogList>
        </DataPanel>
      ) : null}

      <FormPanel
        title="Compose event"
        titleVariant="prominent"
        description={
          <>
            Request body for{' '}
            <code className="send-event-api-endpoint">POST /v1/events</code>. The API responds with{' '}
            <strong className="font-medium text-ink">202 Accepted</strong> — webhook deliveries are
            queued immediately.
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
              <CatalogButton
                type="submit"
                form="send-event-form"
                disabled={submitting}
                className="sm-btn-split h-[2.125rem] min-h-0"
              >
                <span className="sm-btn-split-label text-[0.8125rem]">
                  {submitting ? 'Sending…' : 'Send event'}
                </span>
                <span
                  className="sm-btn-split-icon"
                  style={{ width: '2.125rem', minWidth: '2.125rem' }}
                >
                  <Send className="size-3.5" aria-hidden="true" />
                </span>
              </CatalogButton>
              <CatalogButton
                type="button"
                variant="secondary"
                onClick={handleResetForm}
                disabled={submitting}
                className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset form
              </CatalogButton>
            </div>
          </>
        }
      >
        <form id="send-event-form" className="send-event-form" onSubmit={handleSubmit}>
          <fieldset className="m-0 border-0 p-0" disabled={submitting}>
            <legend className="sr-only">Send event</legend>

            {submitError ? (
              <div className="send-event-form-error" role="alert">
                <p className="send-event-form-error__title">Could not send event</p>
                <p className="send-event-form-error__desc">{submitError}</p>
              </div>
            ) : null}

            <div className="send-event-fields">
              <SendEventField
                id="idempotency-key"
                variant="plain"
                label="Idempotency key"
                hint="Auto-generated UUID. Reusing the same key returns the original event without creating new deliveries."
                action={
                  <CatalogButton
                    type="button"
                    variant="secondary"
                    className="send-event-field__head-btn"
                    onClick={handleRegenerateKey}
                    disabled={submitting}
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    New UUID
                  </CatalogButton>
                }
              >
                <div className="send-event-id-strip">
                  <CatalogInput
                  id="idempotency-key"
                  value={idempotencyKey}
                  onChange={(event) =>
                    dispatch({ type: 'set_idempotency_key', value: event.target.value })
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
                <CatalogInput
                  id="event-type"
                  value={type}
                  onChange={(event) => dispatch({ type: 'set_type', value: event.target.value })}
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
                error={payloadError}
              >
                <CatalogTextarea
                  id="event-payload"
                  value={payloadText}
                  onChange={(event) =>
                    dispatch({ type: 'set_payload_text', value: event.target.value })
                  }
                  rows={PAYLOAD_LINE_COUNT}
                  className="send-event-control-editor"
                  spellCheck={false}
                  required
                  aria-invalid={payloadError !== null}
                  aria-describedby={fieldDescribedBy('event-payload', false, payloadError !== null)}
                />
              </SendEventField>
            </div>
          </fieldset>
        </form>
      </FormPanel>
    </ConsolePage>
  )
}
