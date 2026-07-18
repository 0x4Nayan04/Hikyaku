import type { ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import {
  Ban,
  CheckCircle2,
  Circle,
  Copy,
  Globe,
  MoreVertical,
  Pencil,
  Power,
  PowerOff,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { DeliveryStatus, Endpoint } from '@/api/types'
import { formatDeliveryStatusLabel } from '@/components/console/CatalogDateStack'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  formatCreatedStacked,
  formatDeliveryTime,
  formatEndpointUrlForDisplay,
  shortId,
} from '@/lib/format'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

async function copyValue(value: string, label: string) {
  await navigator.clipboard.writeText(value)
  toast.success(`${label} copied`)
}

export type EndpointRowLastDelivery = {
  deliveryId: string
  status: DeliveryStatus
  updatedAt: string
  error: string | null
}

type EndpointIconVariant = 'active' | 'disabled'

function getEndpointIconVariant(endpoint: Endpoint): EndpointIconVariant {
  return endpoint.status === 'disabled' ? 'disabled' : 'active'
}

const endpointIconConfig: Record<
  EndpointIconVariant,
  { icon: LucideIcon; label: string }
> = {
  active: { icon: Globe, label: 'Active endpoint' },
  disabled: { icon: PowerOff, label: 'Disabled endpoint' },
}

function TableActionButton({
  className,
  children,
  ...props
}: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn('endpoint-catalog-row__action-btn', className)}
      {...props}
    >
      {children}
    </button>
  )
}

function LabelBadge({ label }: { label: string }) {
  return (
    <span className="endpoint-catalog-row__env-badge" title={label}>
      {label}
    </span>
  )
}

function LastDeliveryColumn({
  endpoint,
  lastDelivery,
}: {
  endpoint: Endpoint
  lastDelivery: EndpointRowLastDelivery | null | undefined
}) {
  if (!lastDelivery) {
    const isDisabled = endpoint.status === 'disabled'

    return (
      <div className="endpoint-catalog-row__metric">
        <span className="endpoint-catalog-row__metric-label">Last delivery</span>
        <div className="endpoint-catalog-row__metric-value">
          {isDisabled ? (
            <PowerOff
              className="endpoint-catalog-row__status-icon endpoint-catalog-row__status-icon--muted"
              aria-hidden="true"
            />
          ) : (
            <Circle
              className="endpoint-catalog-row__status-icon endpoint-catalog-row__status-icon--neutral"
              aria-hidden="true"
            />
          )}
          <span
            className={cn(
              'endpoint-catalog-row__status-text',
              isDisabled && 'endpoint-catalog-row__status-text--muted',
            )}
          >
            {isDisabled ? 'Not receiving' : 'No deliveries yet'}
          </span>
        </div>
      </div>
    )
  }

  const statusLabel = formatDeliveryStatusLabel(lastDelivery.status)
  const timeLabel = formatDeliveryTime(lastDelivery.updatedAt)
  const StatusIcon =
    lastDelivery.status === 'succeeded'
      ? CheckCircle2
      : lastDelivery.status === 'failed'
        ? XCircle
        : Circle
  const statusIconClass =
    lastDelivery.status === 'succeeded'
      ? 'endpoint-catalog-row__status-icon--success'
      : lastDelivery.status === 'failed'
        ? 'endpoint-catalog-row__status-icon--danger'
        : 'endpoint-catalog-row__status-icon--neutral'

  return (
    <div className="endpoint-catalog-row__metric">
      <span className="endpoint-catalog-row__metric-label">Last delivery</span>
      <Link
        to={`/deliveries/${lastDelivery.deliveryId}`}
        className="endpoint-catalog-row__metric-link"
        title={
          lastDelivery.error ? `${statusLabel} — ${lastDelivery.error}` : statusLabel
        }
      >
        <div className="endpoint-catalog-row__metric-value">
          <StatusIcon
            className={cn('endpoint-catalog-row__status-icon', statusIconClass)}
            aria-hidden="true"
          />
          <span
            className={cn(
              'endpoint-catalog-row__status-text',
              lastDelivery.status === 'failed' && 'endpoint-catalog-row__status-text--danger',
            )}
          >
            {statusLabel}
          </span>
        </div>
        <time
          className="endpoint-catalog-row__metric-sub"
          dateTime={lastDelivery.updatedAt}
        >
          {timeLabel}
        </time>
      </Link>
    </div>
  )
}

function CreatedColumn({ createdAt }: { createdAt: string }) {
  const { date } = formatCreatedStacked(createdAt)

  return (
    <div className="endpoint-catalog-row__metric endpoint-catalog-row__metric--created">
      <span className="endpoint-catalog-row__metric-label">Created</span>
      <time className="endpoint-catalog-row__metric-value-text" dateTime={createdAt}>
        {date}
      </time>
    </div>
  )
}

type EndpointCatalogRowProps = {
  endpoint: Endpoint
  lastDelivery?: EndpointRowLastDelivery | null
  toggling: boolean
  onEdit: (endpoint: Endpoint) => void
  onToggle: (endpoint: Endpoint) => void
}

function EndpointCatalogRow({
  endpoint,
  lastDelivery,
  toggling,
  onEdit,
  onToggle,
}: EndpointCatalogRowProps) {
  const iconVariant = getEndpointIconVariant(endpoint)
  const { icon: Icon, label: iconLabel } = endpointIconConfig[iconVariant]

  return (
    <article
      className="endpoint-catalog-row"
      data-endpoint-status={endpoint.status}
      data-delivery-health={lastDelivery?.status ?? 'none'}
    >
      <div
        className={cn(
          'endpoint-catalog-row__icon',
          `endpoint-catalog-row__icon--${iconVariant}`,
        )}
        title={iconLabel}
        aria-hidden="true"
      >
        <Icon className="endpoint-catalog-row__icon-glyph" strokeWidth={1.75} />
      </div>

      <div className="endpoint-catalog-row__main">
        <p className="endpoint-catalog-row__url" title={endpoint.url}>
          {formatEndpointUrlForDisplay(endpoint.url, 64)}
        </p>
        <div className="endpoint-catalog-row__meta">
          <code className="endpoint-catalog-row__id" title={endpoint.id}>
            {shortId(endpoint.id, 16)}
          </code>
          {endpoint.description ? (
            <LabelBadge label={endpoint.description} />
          ) : (
            <button
              type="button"
              className="endpoint-catalog-row__add-label"
              onClick={() => onEdit(endpoint)}
            >
              Add label
            </button>
          )}
        </div>
      </div>

      <LastDeliveryColumn endpoint={endpoint} lastDelivery={lastDelivery} />
      <CreatedColumn createdAt={endpoint.created_at} />

      <div className="endpoint-catalog-row__actions">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TableActionButton
              disabled={toggling}
              aria-label={`More actions for ${shortId(endpoint.id)}`}
              title="More actions"
            >
              <MoreVertical className="size-4 shrink-0" aria-hidden="true" />
            </TableActionButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onSelect={() => onEdit(endpoint)}>
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit label
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void copyValue(endpoint.url, 'URL')}>
              <Copy className="size-3.5" aria-hidden="true" />
              Copy URL
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void copyValue(endpoint.id, 'Endpoint ID')}>
              <Copy className="size-3.5" aria-hidden="true" />
              Copy endpoint ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onToggle(endpoint)}
              disabled={toggling}
              variant={endpoint.status === 'active' ? 'destructive' : 'default'}
            >
              {endpoint.status === 'active' ? (
                <Ban className="size-3.5" aria-hidden="true" />
              ) : (
                <Power className="size-3.5" aria-hidden="true" />
              )}
              {endpoint.status === 'active' ? 'Disable endpoint' : 'Enable endpoint'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}

type EndpointCatalogListProps = {
  endpoints: Endpoint[]
  lastDeliveries?: Record<string, EndpointRowLastDelivery | null>
  togglingId: string | null
  onEdit: (endpoint: Endpoint) => void
  onToggle: (endpoint: Endpoint) => void
}

export function EndpointCatalogList({
  endpoints,
  lastDeliveries = {},
  togglingId,
  onEdit,
  onToggle,
}: EndpointCatalogListProps) {
  return (
    <div className="endpoint-catalog-list">
      {endpoints.map((endpoint) => (
        <EndpointCatalogRow
          key={endpoint.id}
          endpoint={endpoint}
          lastDelivery={lastDeliveries[endpoint.id]}
          toggling={togglingId === endpoint.id}
          onEdit={onEdit}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}
