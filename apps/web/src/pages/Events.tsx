import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Send } from 'lucide-react'
import { listEvents } from '@/api/client'
import type { EventStatus, EventSummary } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConsolePage } from '@/components/console/ConsolePage'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/console/DataTable'
import { DataPanel } from '@/components/console/DataPanel'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { PaginationBar } from '@/components/console/PaginationBar'
import { PAGE_SIZE, pageRange, shouldPaginate } from '@/components/console/pagination-utils'
import { StatusBadge } from '@/components/console/StatusBadge'
import { DataPanelEmpty } from '@/components/console/DataPanelEmpty'
import { formatDateTime } from '@/lib/format'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { usePolling } from '@/hooks/usePolling'

const STATUS_OPTIONS: Array<{ value: 'all' | EventStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'In progress' },
  { value: 'completed', label: 'All delivered' },
  { value: 'partial_failure', label: 'Partial Failure' },
  { value: 'failed', label: 'Failed' },
  { value: 'no_recipients', label: 'No Recipients' },
]

function parseStatusParam(value: string | null): 'all' | EventStatus {
  switch (value) {
    case 'pending':
    case 'completed':
    case 'partial_failure':
    case 'failed':
    case 'no_recipients':
      return value
    default:
      return 'all'
  }
}

export default function Events() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = parseStatusParam(searchParams.get('status'))
  const {
    data: events,
    hasMore,
    offset,
    setOffset,
    isInitial,
    isEmpty: showEmpty,
    isRefreshing,
    error,
    reload,
  } = usePaginatedList<EventSummary>({
    pageSize: PAGE_SIZE,
    fetchPage: ({ limit, offset, signal }) =>
      listEvents(
        {
          limit,
          offset,
          status: statusFilter === 'all' ? undefined : statusFilter,
        },
        { signal },
      ),
    fallbackError: 'Failed to load events',
    queryKey: statusFilter,
  })
  usePolling({ intervalMs: 10_000, onPoll: reload })

  const isDatasetEmpty = showEmpty && statusFilter === 'all' && offset === 0

  function setStatusFilter(value: 'all' | EventStatus) {
    const next = new URLSearchParams(searchParams)
    if (value === 'all') next.delete('status')
    else next.set('status', value)
    setSearchParams(next, { replace: true })
    setOffset(0)
  }

  const emptyState =
    statusFilter === 'all' ? (
      <DataPanelEmpty
        icon={Send}
        title="No events yet"
        description={
          <>
            Ingested events appear here after you send one.
            <br />
            <Link to="/events/send" className="font-medium text-primary hover:underline">
              Send a test event
            </Link>
            .
          </>
        }
      />
    ) : (
      <DataPanelEmpty
        icon={Search}
        title="No events match this status"
        description="Choose a different status or view all events."
      />
    )

  const eventPanelActions = (
    <search className="log-panel-actions" aria-label="Filter events">
      <Select
        value={statusFilter}
        onValueChange={(value) => setStatusFilter(parseStatusParam(value))}
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

  const { pageStart, pageEnd } = pageRange(offset, events.length)
  const canGoBack = offset > 0
  const canGoForward = hasMore
  const showFooter = !isInitial && shouldPaginate(hasMore, offset)

  return (
    <ConsolePage
      title="Events"
      description="Ingested events for this tenant. Open a row for payload and delivery outcomes."
      actions={
        <Button size="sm" className="sm-btn-split" asChild>
          <Link to="/events/send">
            <span className="sm-btn-split-label">Test event</span>
            <span className="sm-btn-split-icon">
              <Send className="size-3.5" aria-hidden="true" />
            </span>
          </Link>
        </Button>
      }
    >
      {error ? (
        <PageBanner variant="error" title="Could not load events" description={error} />
      ) : null}

      {isInitial && events.length === 0 ? (
        <PageLoading variant="table" />
      ) : (
        <DataPanel
          title={isDatasetEmpty ? undefined : 'Ingest log'}
          loading={isRefreshing}
          actions={isDatasetEmpty ? undefined : eventPanelActions}
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
          {events.length > 0 ? (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Type</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead className="hidden md:table-cell">Idempotency key</DataTableHead>
                  <DataTableHead className="hidden lg:table-cell">Event ID</DataTableHead>
                  <DataTableHead className="whitespace-nowrap">Created</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {events.map((event) => (
                  <DataTableRow
                    key={event.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="link"
                    aria-label={`Open event ${event.type}`}
                    onClick={() => navigate(`/events/${event.id}`)}
                    onKeyDown={(keyboardEvent) => {
                      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                        keyboardEvent.preventDefault()
                        navigate(`/events/${event.id}`)
                      }
                    }}
                  >
                    <DataTableCell>
                      <span className="font-medium text-ink group-hover:text-primary">
                        {event.type}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge kind="event" status={event.status} />
                    </DataTableCell>
                    <DataTableCell
                      className="hidden max-w-[14rem] truncate font-mono text-xs text-muted-strong md:table-cell"
                      title={event.idempotency_key}
                    >
                      {event.idempotency_key}
                    </DataTableCell>
                    <DataTableCell
                      className="hidden max-w-[14rem] truncate font-mono text-xs text-muted-strong lg:table-cell"
                      title={event.id}
                    >
                      {event.id}
                    </DataTableCell>
                    <DataTableCell className="whitespace-nowrap text-sm text-muted-strong">
                      {formatDateTime(event.created_at)}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          ) : showEmpty ? (
            emptyState
          ) : null}
        </DataPanel>
      )}
    </ConsolePage>
  )
}
