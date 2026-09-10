import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Globe, Plus } from 'lucide-react'
import { toast } from '@/lib/toast'
import { ApiError, listEndpoints, patchEndpoint } from '@/api/client'
import type { Endpoint, EndpointStatus } from '@/api/types'
import { ConsolePage } from '@/components/console/ConsolePage'
import { DataPanel } from '@/components/console/DataPanel'
import { EndpointCatalogList } from '@/components/console/EndpointCatalogList'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { PaginationBar } from '@/components/console/PaginationBar'
import { PAGE_SIZE, pageRange, shouldPaginate } from '@/components/console/pagination-utils'
import { DataPanelEmpty } from '@/components/console/DataPanelEmpty'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { EndpointDialogs } from '@/pages/endpoint-dialogs'

const STATUS_OPTIONS: Array<{ value: 'all' | EndpointStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
]

function parseStatusParam(value: string | null): 'all' | EndpointStatus {
  if (value === 'active' || value === 'disabled') return value
  return 'all'
}

export default function Endpoints() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = parseStatusParam(searchParams.get('status'))
  const {
    data: endpoints,
    hasMore,
    offset,
    setOffset,
    isInitial,
    isRefreshing,
    error,
    reload,
  } = usePaginatedList<Endpoint>({
    pageSize: PAGE_SIZE,
    fetchPage: ({ limit, offset, signal }) =>
      listEndpoints(
        {
          limit,
          offset,
          status: statusFilter === 'all' ? undefined : statusFilter,
        },
        { signal },
      ),
    fallbackError: 'Failed to load endpoints',
    queryKey: statusFilter,
  })
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Endpoint | null>(null)

  const showEmpty = !isInitial && endpoints.length === 0
  const showLoading = isInitial && endpoints.length === 0
  const isDatasetEmpty = showEmpty && statusFilter === 'all' && offset === 0

  function setStatusFilter(value: 'all' | EndpointStatus) {
    const next = new URLSearchParams(searchParams)
    if (value === 'all') next.delete('status')
    else next.set('status', value)
    setSearchParams(next, { replace: true })
    setOffset(0)
  }

  async function handleToggleStatus(endpoint: Endpoint) {
    const nextStatus = endpoint.status === 'active' ? 'disabled' : 'active'
    setTogglingId(endpoint.id)

    try {
      await patchEndpoint(endpoint.id, { status: nextStatus })
      await reload()
      toast.success(nextStatus === 'active' ? 'Endpoint enabled' : 'Endpoint disabled')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update endpoint')
    } finally {
      setTogglingId(null)
    }
  }

  const { pageStart, pageEnd } = pageRange(offset, endpoints.length)
  const canGoBack = offset > 0
  const canGoForward = hasMore
  const showFooter = !isInitial && shouldPaginate(hasMore, offset)

  return (
    <ConsolePage
      title="Endpoints"
      description="Receiver URLs for this tenant. Signing secrets are shown once on create."
    >
      {error ? (
        <PageBanner variant="error" title="Could not load endpoints" description={error} />
      ) : null}

      {showLoading ? (
        <PageLoading variant="table" />
      ) : (
        <DataPanel
          className="endpoint-panel"
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
          {showEmpty && isDatasetEmpty ? null : (
            <div className="endpoint-panel-toolbar">
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
              <div className="endpoint-panel-toolbar__actions">
                <Button
                  size="sm"
                  className="endpoint-panel-toolbar__create gap-1.5"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Create endpoint
                </Button>
              </div>
            </div>
          )}
          {endpoints.length > 0 ? (
            <EndpointCatalogList
              endpoints={endpoints}
              togglingId={togglingId}
              onEdit={(endpoint) => setEditTarget(endpoint)}
              onToggle={handleToggleStatus}
            />
          ) : showEmpty ? (
            <DataPanelEmpty
              icon={Globe}
              title={statusFilter === 'disabled' ? 'No disabled endpoints' : 'No endpoints yet'}
              description={
                statusFilter !== 'all' ? (
                  'Try another status filter.'
                ) : (
                  <>
                    Register a URL where signed webhook payloads should be delivered.{' '}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => setCreateOpen(true)}
                    >
                      Create your first endpoint
                    </button>
                    .
                  </>
                )
              }
            />
          ) : null}
        </DataPanel>
      )}

      <EndpointDialogs
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
        editTarget={editTarget}
        onEditTargetChange={setEditTarget}
        onChanged={reload}
      />
    </ConsolePage>
  )
}
