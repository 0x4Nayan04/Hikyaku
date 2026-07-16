import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Send } from 'lucide-react'
import { ApiError, listDeliveries } from '@/api/client'
import type { Delivery, DeliveryStatus } from '@/api/types'
import {
  CatalogSelect,
  CatalogSelectContent,
  CatalogSelectItem,
  CatalogSelectTrigger,
  CatalogSelectValue,
} from '@/components/catalog/CatalogSelect'
import { CatalogInput } from '@/components/catalog/CatalogInput'
import { ConsolePage } from '@/components/console/ConsolePage'
import { DeliveryCatalogList } from '@/components/console/DeliveryCatalogList'
import { DataPanel } from '@/components/console/DataPanel'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { PaginationBar } from '@/components/console/PaginationBar'
import { DataPanelEmpty } from '@/components/console/DataPanelEmpty'
import { LiveConnectionPill } from '@/components/layout/LiveConnectionPill'
import { useDeliveryLiveUpdates } from '@/hooks/useDeliveryLiveUpdates'

const PAGE_SIZE = 25

const STATUS_OPTIONS: Array<{ value: 'all' | DeliveryStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'deferred', label: 'Deferred' },
]

function matchesStatusFilter(delivery: Delivery, statusFilter: 'all' | DeliveryStatus): boolean {
  return statusFilter === 'all' || delivery.status === statusFilter
}

function matchesSearch(delivery: Delivery, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return (
    delivery.event_id.toLowerCase().includes(normalized) ||
    delivery.endpoint_id.toLowerCase().includes(normalized) ||
    delivery.id.toLowerCase().includes(normalized)
  )
}

type DeliveriesListState = {
  deliveries: Delivery[]
  total: number
  offset: number
  statusFilter: 'all' | DeliveryStatus
  isInitial: boolean
  isRefreshing: boolean
  error: string | null
}

type DeliveriesListAction =
  | { type: 'set_status_filter'; statusFilter: 'all' | DeliveryStatus }
  | { type: 'set_offset'; offset: number }
  | { type: 'refresh_start' }
  | { type: 'load_success'; deliveries: Delivery[]; total: number; offset: number }
  | { type: 'load_failure'; error: string }
  | { type: 'load_complete' }
  | { type: 'delivery_updated'; delivery: Delivery }

const initialDeliveriesListState: DeliveriesListState = {
  deliveries: [],
  total: 0,
  offset: 0,
  statusFilter: 'all',
  isInitial: true,
  isRefreshing: false,
  error: null,
}

function deliveriesListReducer(
  state: DeliveriesListState,
  action: DeliveriesListAction,
): DeliveriesListState {
  switch (action.type) {
    case 'set_status_filter':
      return { ...state, offset: 0, statusFilter: action.statusFilter }
    case 'set_offset':
      return { ...state, offset: action.offset }
    case 'refresh_start':
      return { ...state, isRefreshing: true }
    case 'load_success':
      return {
        ...state,
        deliveries: action.deliveries,
        total: action.total,
        offset: action.offset,
        error: null,
      }
    case 'load_failure':
      return { ...state, error: action.error }
    case 'load_complete':
      return { ...state, isInitial: false, isRefreshing: false }
    case 'delivery_updated': {
      const index = state.deliveries.findIndex((delivery) => delivery.id === action.delivery.id)
      if (index === -1) return state
      if (!matchesStatusFilter(action.delivery, state.statusFilter)) {
        return {
          ...state,
          deliveries: state.deliveries.filter((delivery) => delivery.id !== action.delivery.id),
          total: Math.max(0, state.total - 1),
        }
      }
      const next = [...state.deliveries]
      next[index] = action.delivery
      return { ...state, deliveries: next }
    }
    default: {
      action satisfies never
      return state
    }
  }
}

export function Deliveries() {
  const [state, dispatch] = useReducer(deliveriesListReducer, initialDeliveriesListState)
  const { deliveries, total, offset, statusFilter, isInitial, isRefreshing, error } = state
  const hasDataRef = useRef(false)
  const [searchQuery, setSearchQuery] = useState('')

  const loadDeliveries = useCallback(
    async (nextOffset: number, nextStatus: 'all' | DeliveryStatus, background = false) => {
      if (background) dispatch({ type: 'refresh_start' })
      try {
        const result = await listDeliveries({
          limit: PAGE_SIZE,
          offset: nextOffset,
          status: nextStatus === 'all' ? undefined : nextStatus,
        })
        dispatch({
          type: 'load_success',
          deliveries: result.data,
          total: result.total,
          offset: result.offset,
        })
        hasDataRef.current = true
      } catch (err) {
        dispatch({
          type: 'load_failure',
          error: err instanceof ApiError ? err.message : 'Failed to load deliveries',
        })
      } finally {
        dispatch({ type: 'load_complete' })
      }
    },
    [],
  )

  useEffect(() => {
    void loadDeliveries(offset, statusFilter, hasDataRef.current)
  }, [loadDeliveries, offset, statusFilter])

  const { mode } = useDeliveryLiveUpdates({
    onDeliveryUpdated: (updated) => {
      dispatch({ type: 'delivery_updated', delivery: updated })
    },
    onPoll: () => void loadDeliveries(offset, statusFilter, true),
  })

  const filteredDeliveries = useMemo(
    () => deliveries.filter((delivery) => matchesSearch(delivery, searchQuery)),
    [deliveries, searchQuery],
  )

  const hasSearch = searchQuery.trim().length > 0
  const showEmpty = !isInitial && filteredDeliveries.length === 0
  const isDatasetEmpty = showEmpty && !hasSearch && statusFilter === 'all' && total === 0
  const showToolbar = !isDatasetEmpty

  const emptyState = useMemo(() => {
    if (hasSearch) {
      return (
        <DataPanelEmpty
          variant="inline"
          icon={Search}
          title="No matches on this page"
          description="Try a different event, endpoint, or delivery ID."
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
  }, [hasSearch, statusFilter])

  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + deliveries.length, total)
  const canGoBack = offset > 0
  const canGoForward = offset + PAGE_SIZE < total
  const showFooter = !isInitial && total > 0

  const deliveryPanelChrome = (
    <div className="log-panel-toolbar" role="search" aria-label="Filter deliveries">
      <div className="log-panel-toolbar__search">
        <Search className="log-panel-toolbar__search-icon" aria-hidden="true" />
        <CatalogInput
          type="search"
          placeholder="Filter this page by event, endpoint, or delivery ID…"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="log-panel-toolbar__search-input"
          aria-label="Filter deliveries on this page"
        />
      </div>

      <div className="log-panel-toolbar__filters" role="group" aria-label="Delivery filters">
        <CatalogSelect
          value={statusFilter}
          onValueChange={(value) =>
            dispatch({
              type: 'set_status_filter',
              statusFilter: value as 'all' | DeliveryStatus,
            })
          }
        >
          <CatalogSelectTrigger className="log-panel-toolbar__filter">
            <CatalogSelectValue placeholder="Status" />
          </CatalogSelectTrigger>
          <CatalogSelectContent>
            {STATUS_OPTIONS.map((option) => (
              <CatalogSelectItem key={option.value} value={option.value}>
                {option.label}
              </CatalogSelectItem>
            ))}
          </CatalogSelectContent>
        </CatalogSelect>
      </div>
    </div>
  )

  return (
    <ConsolePage
      title="Deliveries"
      description="Outbound webhook attempts per endpoint."
      actions={<LiveConnectionPill mode={mode} />}
    >
      {error ? (
        <PageBanner variant="error" title="Could not load deliveries" description={error} />
      ) : null}

      {isInitial && deliveries.length === 0 ? (
        <PageLoading variant="table" />
      ) : (
        <DataPanel
          loading={isRefreshing}
          footer={
            showFooter ? (
              <div className="pagination-bar-footer">
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
                {hasSearch && deliveries.length > 0 ? (
                  <p className="pagination-bar__note">
                    Showing {filteredDeliveries.length} of {deliveries.length} on this page
                  </p>
                ) : null}
              </div>
            ) : undefined
          }
        >
          {showToolbar ? deliveryPanelChrome : null}
          {filteredDeliveries.length > 0 ? (
            <DeliveryCatalogList deliveries={filteredDeliveries} />
          ) : showEmpty ? (
            emptyState
          ) : null}
        </DataPanel>
      )}
    </ConsolePage>
  )
}
