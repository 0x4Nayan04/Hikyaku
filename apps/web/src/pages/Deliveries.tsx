import { useMemo } from 'react'
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
import { pageRange, shouldPaginate } from '@/components/console/pagination-utils'
import { DataPanelEmpty } from '@/components/console/DataPanelEmpty'
import { LiveChip } from '@/components/console/LiveChip'
import { usePolling } from '@/hooks/usePolling'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { hasActiveDeliveryWork } from '@/lib/polling-utils'

const PAGE_SIZE = 25

const STATUS_OPTIONS: Array<{ value: 'all' | DeliveryStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
]

function parseStatusParam(value: string | null): 'all' | DeliveryStatus {
  if (
    value === 'pending' ||
    value === 'in_progress' ||
    value === 'succeeded' ||
    value === 'failed'
  ) {
    return value
  }
  return 'all'
}

export function Deliveries() {
  const [searchParams, setSearchParams] = useSearchParams()
  const eventIdFilter = searchParams.get('event_id') || undefined
  const statusFilter = parseStatusParam(searchParams.get('status'))
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
        },
        { signal },
      ),
    fallbackError: 'Failed to load deliveries',
    queryKey: JSON.stringify([statusFilter, eventIdFilter]),
  })

  usePolling({ enabled: hasActiveDeliveryWork(deliveries), onPoll: reload })

  const isLive = error === null
  const showEmpty = !isInitial && deliveries.length === 0
  const isDatasetEmpty = showEmpty && statusFilter === 'all' && !eventIdFilter && offset === 0
  const emptyState = useMemo(() => {
    if (eventIdFilter) {
      return (
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
    }

    if (statusFilter !== 'all') {
      return (
        <DataPanelEmpty
          variant="inline"
          icon={Search}
          title="No deliveries match this status"
          description="Choose a different status or view all deliveries."
        />
      )
    }

    return (
      <DataPanelEmpty
        icon={Send}
        title="No deliveries yet"
        description={
          <>
            Outbound webhook attempts appear here after you send an event.{' '}
            <Link to="/events/send" className="font-medium text-primary hover:underline">
              Send a test event
            </Link>
            .
          </>
        }
      />
    )
  }, [statusFilter, eventIdFilter])

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
      description="Outbound webhook attempts. Open a row for request and response details."
      actions={<LiveChip active={isLive} />}
    >
      {error ? (
        <PageBanner variant="error" title="Could not load deliveries" description={error} />
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
