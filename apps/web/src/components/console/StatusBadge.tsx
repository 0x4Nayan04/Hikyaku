import type { DeliveryStatus, EndpointStatus, EventStatus, SignupRequestStatus } from '@/api/types'
import { CatalogChip, type CatalogChipTone } from '@/components/catalog/CatalogChip'
import { cn } from '@/lib/utils'

const deliveryTone: Record<DeliveryStatus, CatalogChipTone> = {
  pending: 'neutral',
  in_progress: 'info',
  succeeded: 'success',
  failed: 'danger',
  deferred: 'warning',
}

const eventTone: Record<EventStatus, CatalogChipTone> = {
  pending: 'warning',
  completed: 'success',
  failed: 'danger',
}

const endpointTone: Record<EndpointStatus, CatalogChipTone> = {
  active: 'success',
  disabled: 'muted',
}

const signupTone: Record<SignupRequestStatus, CatalogChipTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

function formatStatusLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

type StatusBadgeProps = (
  | { kind: 'delivery'; status: DeliveryStatus }
  | { kind: 'event'; status: EventStatus }
  | { kind: 'endpoint'; status: EndpointStatus }
  | { kind: 'api-key'; revoked: boolean }
  | { kind: 'signup'; status: SignupRequestStatus }
  | { kind: 'label'; label: string; tone?: CatalogChipTone }
) & { className?: string }

function getLabel(props: StatusBadgeProps): string {
  switch (props.kind) {
    case 'delivery':
      return formatStatusLabel(props.status)
    case 'event':
    case 'endpoint':
    case 'signup':
      return formatStatusLabel(props.status)
    case 'api-key':
      return props.revoked ? 'Revoked' : 'Active'
    case 'label':
      return props.label
  }
}

function getTone(props: StatusBadgeProps): CatalogChipTone {
  switch (props.kind) {
    case 'delivery':
      return deliveryTone[props.status]
    case 'event':
      return eventTone[props.status]
    case 'endpoint':
      return endpointTone[props.status]
    case 'api-key':
      return props.revoked ? 'muted' : 'success'
    case 'signup':
      return signupTone[props.status]
    case 'label':
      return props.tone ?? 'neutral'
  }
}

export function StatusBadge({ className, ...props }: StatusBadgeProps) {
  const tone = getTone(props)
  const label = getLabel(props)

  return (
    <CatalogChip variant="status" tone={tone} className={cn(className)}>
      {label}
    </CatalogChip>
  )
}
