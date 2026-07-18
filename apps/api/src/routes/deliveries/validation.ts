import { DELIVERY_STATUSES, type DeliveryStatus } from '@webhook/shared/constants'
import { AppError } from '../../lib/errors.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DELIVERY_STATUS_SET = new Set<string>(DELIVERY_STATUSES)

export function parseDeliveryId(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new AppError(404, 'not_found', 'Delivery not found')
  }
}

export function assertReplayableStatus(status: string): void {
  if (status !== 'failed') {
    throw new AppError(400, 'invalid_state', 'Only failed deliveries can be replayed')
  }
}

export function parseListQuery(query: {
  status?: string | string[]
  event_id?: string | string[]
}): { status?: DeliveryStatus; eventId?: string } {
  const statusRaw = Array.isArray(query.status) ? query.status[0] : query.status
  const eventIdRaw = Array.isArray(query.event_id) ? query.event_id[0] : query.event_id

  const result: { status?: DeliveryStatus; eventId?: string } = {}

  if (statusRaw !== undefined) {
    if (!DELIVERY_STATUS_SET.has(statusRaw)) {
      throw new AppError(400, 'validation_error', 'Invalid status filter')
    }
    result.status = statusRaw as DeliveryStatus
  }

  if (eventIdRaw !== undefined) {
    if (!UUID_RE.test(eventIdRaw)) {
      throw new AppError(400, 'validation_error', 'Invalid event_id filter')
    }
    result.eventId = eventIdRaw
  }

  return result
}
