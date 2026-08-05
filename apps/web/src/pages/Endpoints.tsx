import { useState } from 'react'
import { Globe, Plus } from 'lucide-react'
import { toast } from '@/lib/toast'
import { ApiError, createEndpoint, listEndpoints, patchEndpoint } from '@/api/client'
import type { Endpoint, EndpointWithSecret } from '@/api/types'
import { ConsolePage } from '@/components/console/ConsolePage'
import { DataPanel } from '@/components/console/DataPanel'
import { EndpointCatalogList } from '@/components/console/EndpointCatalogList'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { PaginationBar } from '@/components/console/PaginationBar'
import { shouldPaginate } from '@/components/console/pagination-utils'
import { DataPanelEmpty } from '@/components/console/DataPanelEmpty'
import { Button } from '@/components/ui/button'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { EndpointDialogs } from '@/pages/endpoint-dialogs'

const API_PAGE_SIZE = 25

export function Endpoints() {
  const {
    data: endpoints,
    total,
    offset,
    setOffset,
    isInitial,
    isRefreshing,
    error,
    reload,
  } = usePaginatedList<Endpoint>({
    pageSize: API_PAGE_SIZE,
    fetchPage: ({ limit, offset, signal }) => listEndpoints({ limit, offset }, { signal }),
    fallbackError: 'Failed to load endpoints',
  })
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editTarget, setEditTarget] = useState<Endpoint | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [secretEndpoint, setSecretEndpoint] = useState<EndpointWithSecret | null>(null)

  const showEmpty = !isInitial && endpoints.length === 0
  const showLoading = isInitial && endpoints.length === 0

  function handleCreateOpenChange(open: boolean) {
    setCreateOpen(open)
    if (!open) {
      setUrl('')
      setDescription('')
    }
  }

  function handleEditOpen(endpoint: Endpoint) {
    setEditTarget(endpoint)
    setEditDescription(endpoint.description ?? '')
    setEditSubmitting(false)
  }

  function handleEditClose() {
    setEditTarget(null)
    setEditDescription('')
    setEditSubmitting(false)
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    try {
      const created = await createEndpoint({
        url,
        description: description.trim() || undefined,
      })
      handleCreateOpenChange(false)
      setSecretEndpoint(created)
      await reload()
      toast.success('Endpoint created')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create endpoint')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editTarget) return

    setEditSubmitting(true)

    try {
      await patchEndpoint(editTarget.id, {
        description: editDescription.trim(),
      })
      handleEditClose()
      await reload()
      toast.success('Endpoint updated')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update endpoint')
    } finally {
      setEditSubmitting(false)
    }
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

  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + endpoints.length, total)
  const canGoBack = offset > 0
  const canGoForward = offset + API_PAGE_SIZE < total
  const showFooter = !isInitial && total > 0 && shouldPaginate(total, API_PAGE_SIZE)

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
                  total={total}
                  canGoBack={canGoBack}
                  canGoForward={canGoForward}
                  onPrevious={() => setOffset(Math.max(0, offset - API_PAGE_SIZE))}
                  onNext={() => setOffset(offset + API_PAGE_SIZE)}
                />
              </div>
            ) : undefined
          }
        >
          {showEmpty ? null : (
            <div className="endpoint-panel-toolbar">
              <div className="endpoint-panel-toolbar__actions">
                <Button
                  size="sm"
                  className="endpoint-panel-toolbar__create gap-1.5"
                  onClick={() => setCreateOpen(true)}
                  disabled={submitting}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  {submitting ? 'Creating…' : 'Create endpoint'}
                </Button>
              </div>
            </div>
          )}
          {endpoints.length > 0 ? (
            <EndpointCatalogList
              endpoints={endpoints}
              togglingId={togglingId}
              onEdit={handleEditOpen}
              onToggle={handleToggleStatus}
            />
          ) : showEmpty ? (
            <DataPanelEmpty
              icon={Globe}
              title="No endpoints yet"
              description={
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
              }
            />
          ) : null}
        </DataPanel>
      )}

      <EndpointDialogs
        createOpen={createOpen}
        onCreateOpenChange={handleCreateOpenChange}
        url={url}
        onUrlChange={setUrl}
        description={description}
        onDescriptionChange={setDescription}
        submitting={submitting}
        onCreate={handleCreate}
        editTarget={editTarget}
        editDescription={editDescription}
        onEditDescriptionChange={setEditDescription}
        editSubmitting={editSubmitting}
        onEdit={handleEdit}
        onEditClose={handleEditClose}
        secretEndpoint={secretEndpoint}
        onSecretEndpointChange={setSecretEndpoint}
      />
    </ConsolePage>
  )
}
