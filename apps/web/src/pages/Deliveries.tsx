import { Link, useSearchParams } from 'react-router-dom'
import { Search, Send, X } from 'lucide-react'
import { listDeliveries } from '@/api/client'
import type { Delivery, DeliveryStatus } from '@/api/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConsolePage } from '@/components/console/ConsolePage'
import { DeliveryCatalogList } from '@/components/console/DeliveryCatalogList'
import { DataPanel } from '@/components/console/DataPanel'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { PaginationBar } from '@/components/console/PaginationBar'
import { PAGE_SIZE, pageRange, shouldPaginate } from '@/components/console/pagination-utils'
import { DataPanelEmpty } from '@/components/console/DataPanelEmpty'
import { LiveChip } from '@/components/console/LiveChip'
import { usePolling } from '@/hooks/usePolling'
import { usePaginatedList } from '@/hooks/usePaginatedList'

type DeliveryListStatus = 'all' | DeliveryStatus | 'open'

const STATUS_OPTIONS: Array<{ value: DeliveryListStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
]

function parseStatusParam(value: string | null): DeliveryListStatus {
  if (
    value === 'open' ||
    value === 'pending' ||
    value === 'in_progress' ||
    value === 'succeeded' ||
    value === 'failed'
  ) {
    return value
  }
  return 'all'
}

export default function Deliveries() {
  const [searchParams, setSearchParams] = useSearchParams()
  const eventIdFilter = searchParams.get('event_id') || undefined
  const statusFilter = parseStatusParam(searchParams.get('status'))
  const updatedWithin24h = searchParams.get('updated_within') === '24h'
  const {
    data: deliveries,
    hasMore,
    offset,
    setOffset,
    isInitial,
    isRefreshing,
    error,
    reload,
  } = usePaginatedList<Delivery>({
    pageSize: PAGE_SIZE,
    fetchPage: ({ limit, offset, signal }) =>
      listDeliveries(
        {
          limit,
          offset,
          status: statusFilter === 'all' ? undefined : statusFilter,
          event_id: eventIdFilter,
          updated_within: updatedWithin24h ? '24h' : undefined,
        },
        { signal },
      ),
    fallbackError: 'Failed to load deliveries',
    queryKey: JSON.stringify([statusFilter, eventIdFilter, updatedWithin24h]),
  })

  usePolling({ intervalMs: 10_000, onPoll: reload })

  const isLive = !isInitial && error === null
  const showEmpty = !isInitial && deliveries.length === 0
  const isDatasetEmpty =
    showEmpty && statusFilter === 'all' && !eventIdFilter && !updatedWithin24h && offset === 0

  let emptyState
  if (eventIdFilter) {
    emptyState = (
      <DataPanelEmpty
        variant="inline"
        icon={Search}
        title="No deliveries for this event"
        description={
          <>
            This event has no matching deliveries
            {statusFilter !== 'all' ? ' for the selected status' : ''}.{' '}
            <Link to="/deliveries" className="font-medium text-primary hover:underline">
              View all deliveries
            </Link>
            .
          </>
        }
      />
    )
  } else if (statusFilter !== 'all') {
    emptyState = (
      <DataPanelEmpty
        variant="inline"
        icon={Search}
        title={
          updatedWithin24h ? 'No deliveries match these filters' : 'No deliveries match this status'
        }
        description={
          updatedWithin24h
            ? 'This status has no deliveries updated in the last 24 hours.'
            : 'Choose a different status or view all deliveries.'
        }
      />
    )
  } else if (updatedWithin24h) {
    emptyState = (
      <DataPanelEmpty
        variant="inline"
        icon={Search}
        title="No deliveries in the last 24 hours"
        description="Nothing was updated in that window."
      />
    )
  } else {
    emptyState = (
      <DataPanelEmpty
        icon={Send}
        title="No deliveries yet"
        description={
          <>
            Deliveries appear here after you send an event.{' '}
            <Link to="/events/send" className="font-medium text-primary hover:underline">
              Send a test event
            </Link>
            .
          </>
        }
      />
    )
  }

  const { pageStart, pageEnd } = pageRange(offset, deliveries.length)
  const canGoBack = offset > 0
  const canGoForward = hasMore
  const showFooter = !isInitial && shouldPaginate(hasMore, offset)

  function patchParams(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams)
    mutate(next)
    setSearchParams(next, { replace: true })
    setOffset(0)
  }

  function clearEventFilter() {
    patchParams((next) => {
      next.delete('event_id')
    })
  }

  function clearUpdatedWithin() {
    patchParams((next) => {
      next.delete('updated_within')
    })
  }

  const deliveryPanelActions = (
    <search className="log-panel-actions" aria-label="Filter deliveries">
      <Select
        value={statusFilter}
        onValueChange={(value) => {
          patchParams((next) => {
            if (value === 'all') next.delete('status')
            else next.set('status', value)
          })
        }}
      >
        <SelectTrigger className="log-panel-toolbar__filter" aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </search>
  )

  return (
    <ConsolePage
      title="Deliveries"
      description="One row per event and endpoint. Open a row for each attempt."
      actions={<LiveChip active={isLive} />}
    >
      {error ? (
        <PageBanner variant="error" title="Could not load deliveries" description={error} />
      ) : null}

      {updatedWithin24h ? (
        <PageBanner
          variant="info"
          title="Last 24 hours"
          description={
            <>
              Showing deliveries updated in the last 24 hours.{' '}
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                onClick={clearUpdatedWithin}
              >
                <X className="size-3" aria-hidden="true" />
                Clear time window
              </button>
            </>
          }
        />
      ) : null}

      {eventIdFilter ? (
        <PageBanner
          variant="info"
          title="Filtered by event"
          description={
            <>
              Showing deliveries for{' '}
              <Link
                to={`/events/${eventIdFilter}`}
                className="font-mono text-xs font-medium text-primary hover:underline"
              >
                {eventIdFilter}
              </Link>
              .{' '}
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                onClick={clearEventFilter}
              >
                <X className="size-3" aria-hidden="true" />
                Clear filter
              </button>
            </>
          }
        />
      ) : null}

      {isInitial && deliveries.length === 0 ? (
        <PageLoading variant="table" />
      ) : (
        <DataPanel
          title={isDatasetEmpty ? undefined : 'Delivery log'}
          loading={isRefreshing}
          actions={isDatasetEmpty ? undefined : deliveryPanelActions}
          footer={
            showFooter ? (
              <div className="pagination-bar-footer">
                <PaginationBar
                  pageStart={pageStart}
                  pageEnd={pageEnd}
                  canGoBack={canGoBack}
                  canGoForward={canGoForward}
                  onPrevious={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  onNext={() => setOffset(offset + PAGE_SIZE)}
                />
              </div>
            ) : undefined
          }
        >
          {deliveries.length > 0 ? (
            <DeliveryCatalogList deliveries={deliveries} />
          ) : showEmpty ? (
            emptyState
          ) : null}
        </DataPanel>
      )}
    </ConsolePage>
  )
}
