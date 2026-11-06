import { SendEventField } from '@/components/console/forms/SendEventField'
import { FormPanel } from '@/components/console/forms/FormPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  fieldDescribedBy,
  PAYLOAD_LINE_COUNT,
  type EventFormAction,
  type EventFormState,
} from '@/pages/events/sendEventFormState'
import { RefreshCw, RotateCcw, Send } from 'lucide-react'
import { Link } from 'react-router-dom'

export function SendEventForm({
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
      className="send-event-form-panel"
      title="Compose test event"
      titleVariant="prominent"
      description={
        <>
          <code className="send-event-api-endpoint">POST /v1/events</code> →{' '}
          <strong className="font-medium text-ink">202</strong>, then watch{' '}
          <Link to="/deliveries" className="font-medium text-primary hover:underline">
            Deliveries
          </Link>
          .
        </>
      }
      footerAlign="end"
      footer={
        <div className="send-event-form-actions flex flex-wrap items-center gap-3">
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
              hint="Same key + same body returns the original event."
              action={
                <Button
                  type="button"
                  variant="secondary"
                  className="send-event-field__head-btn"
                  onClick={() =>
                    dispatch({
                      type: 'update',
                      changes: { idempotencyKey: crypto.randomUUID(), submitError: null },
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
              hint="e.g. order.paid"
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
