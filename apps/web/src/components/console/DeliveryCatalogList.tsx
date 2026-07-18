import { Link } from 'react-router-dom'
import type { Delivery } from '@/api/types'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/console/DataTable'
import { StatusBadge } from '@/components/console/StatusBadge'
import { formatDateTime, formatEndpointUrlForDisplay, shortId } from '@/lib/format'

type DeliveryCatalogListProps = {
  deliveries: Delivery[]
}

function formatAttempts(count: number): string {
  return `${count} attempt${count !== 1 ? 's' : ''}`
}

export function DeliveryCatalogList({ deliveries }: DeliveryCatalogListProps) {
  return (
    <DataTable className="delivery-table">
      <DataTableHeader>
        <DataTableRow>
          <DataTableHead>Endpoint</DataTableHead>
          <DataTableHead className="hidden md:table-cell">Event</DataTableHead>
          <DataTableHead>Status</DataTableHead>
          <DataTableHead className="hidden sm:table-cell">Attempts</DataTableHead>
          <DataTableHead className="whitespace-nowrap">Updated</DataTableHead>
        </DataTableRow>
      </DataTableHeader>
      <DataTableBody>
        {deliveries.map((delivery) => (
          <DataTableRow key={delivery.id}>
            <DataTableCell className="max-w-[18rem] md:max-w-[22rem]">
              <Link
                to={`/deliveries/${delivery.id}`}
                className="block min-w-0 font-medium hover:text-primary hover:underline"
                title={delivery.endpoint_url}
              >
                <span className="block truncate">
                  {formatEndpointUrlForDisplay(delivery.endpoint_url, 64)}
                </span>
              </Link>
              {delivery.last_error ? (
                <p className="delivery-table__error" title={delivery.last_error}>
                  {delivery.last_error}
                </p>
              ) : null}
            </DataTableCell>
            <DataTableCell className="hidden md:table-cell">
              <Link
                to={`/events/${delivery.event_id}`}
                className="font-mono text-xs text-muted-strong hover:text-primary hover:underline"
                title={delivery.event_id}
              >
                {shortId(delivery.event_id, 10)}
              </Link>
            </DataTableCell>
            <DataTableCell>
              <StatusBadge kind="delivery" status={delivery.status} />
            </DataTableCell>
            <DataTableCell className="hidden text-sm text-muted-strong sm:table-cell">
              {formatAttempts(delivery.attempt_count)}
            </DataTableCell>
            <DataTableCell className="whitespace-nowrap text-sm text-muted-strong">
              <Link
                to={`/deliveries/${delivery.id}`}
                className="hover:text-primary hover:underline"
              >
                <time dateTime={delivery.updated_at}>{formatDateTime(delivery.updated_at)}</time>
              </Link>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTableBody>
    </DataTable>
  )
}
