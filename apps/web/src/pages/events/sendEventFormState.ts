import type { EventStatus, IngestEventResponse } from '@/api/types'
import type { IngestEventInput } from '@hikyaku/shared/zod'

export const DEFAULT_PAYLOAD = `{
  "order_id": "123",
  "amount": 4999
}`

export const PAYLOAD_LINE_COUNT = DEFAULT_PAYLOAD.split('\n').length

export function parsePayloadJson(raw: string): IngestEventInput['payload'] | null {
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

export function isOpenEventStatus(status: EventStatus): boolean {
  switch (status) {
    case 'pending':
      return true
    case 'completed':
    case 'partial_failure':
    case 'failed':
    case 'no_recipients':
      return false
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

export function fieldDescribedBy(
  id: string,
  hasHint: boolean,
  hasError: boolean,
): string | undefined {
  const ids = [hasHint ? `${id}-hint` : null, hasError ? `${id}-error` : null].filter(Boolean)
  return ids.length > 0 ? ids.join(' ') : undefined
}

export type EventFormState = {
  idempotencyKey: string
  type: string
  payloadText: string
  payloadError: string | null
  submitError: string | null
  submitting: boolean
  result: IngestEventResponse | null
}

export type EventFormAction =
  | { type: 'update'; changes: Partial<EventFormState> }
  | { type: 'status'; id: string; status: EventStatus }
  | { type: 'reset' }

export function createInitialFormState(): EventFormState {
  return {
    idempotencyKey: crypto.randomUUID(),
    type: 'order.paid',
    payloadText: DEFAULT_PAYLOAD,
    payloadError: null,
    submitError: null,
    submitting: false,
    result: null,
  }
}

export function eventFormReducer(state: EventFormState, action: EventFormAction): EventFormState {
  if (action.type === 'reset') return createInitialFormState()
  if (action.type === 'status') {
    return state.result?.id === action.id
      ? { ...state, result: { ...state.result, status: action.status } }
      : state
  }
  return { ...state, ...action.changes }
}
