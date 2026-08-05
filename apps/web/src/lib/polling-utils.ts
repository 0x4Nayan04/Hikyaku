import type { Delivery, EventSummary } from '@/api/types'

export function hasPendingEventWork(events: Pick<EventSummary, 'status'>[]): boolean {
  return events.some((event) => event.status === 'pending')
}

export function hasActiveDeliveryWork(deliveries: Pick<Delivery, 'status'>[]): boolean {
  return deliveries.some(
    (delivery) => delivery.status === 'pending' || delivery.status === 'in_progress',
  )
}
