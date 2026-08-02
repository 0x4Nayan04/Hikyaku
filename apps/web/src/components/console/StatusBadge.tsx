import type { DeliveryStatus, EndpointStatus, EventStatus } from '@/api/types'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { formatStatusLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

const deliveryTone: Record<DeliveryStatus, BadgeTone> = {
  pending: 'neutral',
  in_progress: 'info',
  succeeded: 'success',
  failed: 'danger',
}

const eventTone: Record<EventStatus, BadgeTone> = {
  pending: 'warning',
  completed: 'success',
  failed: 'danger',
}

const endpointTone: Record<EndpointStatus, BadgeTone> = {
  active: 'success',
  disabled: 'muted',
}

type StatusBadgeProps = (
  | { kind: 'delivery'; status: DeliveryStatus }
  | { kind: 'event'; status: EventStatus }
  | { kind: 'endpoint'; status: EndpointStatus }
  | { kind: 'api-key'; revoked: boolean }
  | { kind: 'label'; label: string; tone?: BadgeTone }
) & { className?: string }

function getLabel(props: StatusBadgeProps): string {
  switch (props.kind) {
    case 'delivery':
      return formatStatusLabel(props.status)
    case 'event':
    case 'endpoint':
      return formatStatusLabel(props.status)
    case 'api-key':
      return props.revoked ? 'Revoked' : 'Active'
    case 'label':
      return props.label
  }
}

function getTone(props: StatusBadgeProps): BadgeTone {
  switch (props.kind) {
    case 'delivery':
      return deliveryTone[props.status]
    case 'event':
      return eventTone[props.status]
    case 'endpoint':
      return endpointTone[props.status]
    case 'api-key':
      return props.revoked ? 'muted' : 'success'
    case 'label':
      return props.tone ?? 'neutral'
  }
}

export function StatusBadge({ className, ...props }: StatusBadgeProps) {
  const tone = getTone(props)
  const label = getLabel(props)

  return (
    <Badge variant="status" tone={tone} className={cn(className)}>
      {label}
    </Badge>
  )
}
