import type { DeliveryStatus } from '@/api/types'

export function formatDeliveryStatusLabel(status: DeliveryStatus): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}
