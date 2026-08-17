import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import { listEvents } from '@/api/client'
import type { EventSummary } from '@/api/types'
import { Button } from '@/components/ui/button'
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
import { pageRange, shouldPaginate } from '@/components/console/pagination-utils'
import { StatusBadge } from '@/components/console/StatusBadge'
import { DataPanelEmpty } from '@/components/console/DataPanelEmpty'
import { formatDateTime } from '@/lib/format'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { usePolling } from '@/hooks/usePolling'
import { hasPendingEventWork } from '@/lib/polling-utils'

const PAGE_SIZE = 25

export function Events() {
  const navigate = useNavigate()
  const {
    data: events,
    hasMore,
    offset,
    setOffset,
    isInitial,
    isRefreshing,
    error,
    reload,
  } = usePaginatedList<EventSummary>({
    pageSize: PAGE_SIZE,
    fetchPage: ({ limit, offset, signal }) => listEvents({ limit, offset }, { signal }),
    fallbackError: 'Failed to load events',
  })
  usePolling({ enabled: hasPendingEventWork(events), onPoll: reload })

  const showEmpty = !isInitial && events.length === 0
  const isDatasetEmpty = showEmpty && offset === 0

  const emptyState = useMemo(
    () => (
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
    ),
    [],
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
