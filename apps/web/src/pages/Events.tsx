import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Send } from 'lucide-react'
import { ApiError, listEvents } from '@/api/client'
import type { EventSummary } from '@/api/types'
import { CatalogInput } from '@/components/catalog/CatalogInput'
import { CatalogButton } from '@/components/catalog/CatalogButton'
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
import { shouldPaginate } from '@/components/console/pagination-utils'
import { StatusBadge } from '@/components/console/StatusBadge'
import { DataPanelEmpty } from '@/components/console/DataPanelEmpty'
import { formatDateTime } from '@/lib/format'

const PAGE_SIZE = 25

function matchesSearch(event: EventSummary, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return (
    event.type.toLowerCase().includes(normalized) ||
    event.idempotency_key.toLowerCase().includes(normalized) ||
    event.id.toLowerCase().includes(normalized)
  )
}

type EventsListState = {
  events: EventSummary[]
  total: number
  offset: number
  isInitial: boolean
  isRefreshing: boolean
  error: string | null
}

type EventsListAction =
  | { type: 'set_offset'; offset: number }
  | { type: 'refresh_start' }
  | { type: 'load_success'; events: EventSummary[]; total: number; offset: number }
  | { type: 'load_failure'; error: string }
  | { type: 'load_complete' }

const initialEventsListState: EventsListState = {
  events: [],
  total: 0,
  offset: 0,
  isInitial: true,
  isRefreshing: false,
  error: null,
}

function eventsListReducer(state: EventsListState, action: EventsListAction): EventsListState {
  switch (action.type) {
    case 'set_offset':
      return { ...state, offset: action.offset }
    case 'refresh_start':
      return { ...state, isRefreshing: true }
    case 'load_success':
      return {
        ...state,
        events: action.events,
        total: action.total,
        offset: action.offset,
        error: null,
      }
    case 'load_failure':
      return { ...state, error: action.error }
    case 'load_complete':
      return { ...state, isInitial: false, isRefreshing: false }
    default: {
      action satisfies never
      return state
    }
  }
}

export function Events() {
  const [state, dispatch] = useReducer(eventsListReducer, initialEventsListState)
  const { events, total, offset, isInitial, isRefreshing, error } = state
  const hasDataRef = useRef(false)
  const [searchQuery, setSearchQuery] = useState('')

  const loadEvents = useCallback(async (nextOffset: number, background = false) => {
    if (background) dispatch({ type: 'refresh_start' })
    try {
      const result = await listEvents({ limit: PAGE_SIZE, offset: nextOffset })
      dispatch({
        type: 'load_success',
        events: result.data,
        total: result.total,
        offset: result.offset,
      })
      hasDataRef.current = true
    } catch (err) {
      dispatch({
        type: 'load_failure',
        error: err instanceof ApiError ? err.message : 'Failed to load events',
      })
    } finally {
      dispatch({ type: 'load_complete' })
    }
  }, [])

  useEffect(() => {
    void loadEvents(offset, hasDataRef.current)
  }, [loadEvents, offset])

  const filteredEvents = useMemo(
    () => events.filter((event) => matchesSearch(event, searchQuery)),
    [events, searchQuery],
  )

  const hasSearch = searchQuery.trim().length > 0
  const showEmpty = !isInitial && filteredEvents.length === 0
  const isDatasetEmpty = showEmpty && !hasSearch && total === 0

  const emptyState = useMemo(() => {
    if (hasSearch) {
      return (
        <DataPanelEmpty
          variant="inline"
          icon={Search}
          title="No matches on this page"
          description="Try a different type, idempotency key, or event ID."
        />
      )
    }

    return (
      <DataPanelEmpty
        icon={Send}
        title="No events yet"
        description={
          <>
            Ingested events appear here after you send one.{' '}
            <Link to="/events/send" className="font-medium text-primary hover:underline">
              Send a test event
            </Link>
            .
          </>
        }
      />
    )
  }, [hasSearch])

  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + events.length, total)
  const canGoBack = offset > 0
  const canGoForward = offset + PAGE_SIZE < total
  const showPagination = !isInitial && total > 0 && !hasSearch
  const showFooter =
    !isInitial && total > 0 && (shouldPaginate(total, PAGE_SIZE) || (hasSearch && events.length > 0))

  return (
    <ConsolePage
      title="Events"
      description="Browse ingested events. Open a row to inspect payload and delivery outcomes."
      actions={
        <CatalogButton className="sm-btn-split h-[2.125rem] min-h-0" asChild>
          <Link to="/events/send">
            <span className="sm-btn-split-label text-[0.8125rem]">Send event</span>
            <span className="sm-btn-split-icon" style={{ width: '2.125rem', minWidth: '2.125rem' }}>
              <Send className="size-3.5" aria-hidden="true" />
            </span>
          </Link>
        </CatalogButton>
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
          actions={
            isDatasetEmpty ? undefined : (
            <div className="log-panel-search">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-strong"
                aria-hidden="true"
              />
              <CatalogInput
                type="search"
                placeholder="Filter this page…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="log-panel-search__input"
                aria-label="Filter events on this page"
              />
            </div>
            )
          }
          footer={
            showFooter ? (
              <div className="pagination-bar-footer">
                {showPagination ? (
                  <PaginationBar
                    pageStart={pageStart}
                    pageEnd={pageEnd}
                    total={total}
                    pageSize={PAGE_SIZE}
                    canGoBack={canGoBack}
                    canGoForward={canGoForward}
                    onPrevious={() =>
                      dispatch({ type: 'set_offset', offset: Math.max(0, offset - PAGE_SIZE) })
                    }
                    onNext={() => dispatch({ type: 'set_offset', offset: offset + PAGE_SIZE })}
                  />
                ) : null}
                {hasSearch && events.length > 0 ? (
                  <p className="pagination-bar__note">
                    Showing {filteredEvents.length} of {events.length} on this page
                  </p>
                ) : null}
              </div>
            ) : undefined
          }
        >
          {filteredEvents.length > 0 ? (
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
                {filteredEvents.map((event) => (
                  <DataTableRow key={event.id}>
                    <DataTableCell>
                      <Link
                        to={`/events/${event.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {event.type}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge kind="event" status={event.status} />
                    </DataTableCell>
                    <DataTableCell className="hidden max-w-[11rem] truncate font-mono text-xs text-muted-strong md:table-cell">
                      {event.idempotency_key}
                    </DataTableCell>
                    <DataTableCell className="hidden max-w-[11rem] truncate font-mono text-xs text-muted-strong lg:table-cell">
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
