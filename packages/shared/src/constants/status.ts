export const EVENT_STATUSES = [
  'pending',
  'completed',
  'partial_failure',
  'failed',
  'no_recipients',
] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]

export const DELIVERY_STATUSES = ['pending', 'in_progress', 'succeeded', 'failed'] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export const ENDPOINT_STATUSES = ['active', 'disabled'] as const
export type EndpointStatus = (typeof ENDPOINT_STATUSES)[number]
