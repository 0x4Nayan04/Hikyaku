import { DELIVERY_STATUSES, type DeliveryStatus } from '@hikyaku/shared/constants'
import { AppError } from '../../lib/errors.js'
import { isUuid, queryString, requireUuid } from '../../lib/validation.js'

const DELIVERY_STATUS_SET = new Set<string>(DELIVERY_STATUSES)

export function parseDeliveryId(id: string): void {
  requireUuid(id, 'Delivery not found')
}

export function parseListQuery(query: {
  status?: unknown
  event_id?: unknown
  updated_within?: unknown
}): { status?: DeliveryStatus; open?: boolean; eventId?: string; updatedWithin24h?: boolean } {
  const statusRaw = queryString(query.status, 'status')
  const eventIdRaw = queryString(query.event_id, 'event_id')
  const updatedWithinRaw = queryString(query.updated_within, 'updated_within')

  const result: {
    status?: DeliveryStatus
    open?: boolean
    eventId?: string
    updatedWithin24h?: boolean
  } = {}

  if (statusRaw === 'open') {
    result.open = true
  } else if (statusRaw !== undefined) {
    if (!DELIVERY_STATUS_SET.has(statusRaw)) {
      throw new AppError(400, 'validation_error', 'Invalid status filter')
    }
    result.status = statusRaw as DeliveryStatus
  }

  if (updatedWithinRaw !== undefined) {
    if (updatedWithinRaw !== '24h') {
      throw new AppError(400, 'validation_error', 'Invalid updated_within filter')
    }
    result.updatedWithin24h = true
  }

  if (eventIdRaw !== undefined) {
    if (!isUuid(eventIdRaw)) {
      throw new AppError(400, 'validation_error', 'Invalid event_id filter')
    }
    result.eventId = eventIdRaw
  }

  return result
}
