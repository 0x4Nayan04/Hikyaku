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
import { SendEventField } from '@/components/console/SendEventField'
import { SettingsCopyValue } from '@/components/console/SettingsCatalog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
    fetchPage: listEndpoints,
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

  const emptyState = (
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
  )

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    try {
      const created = await createEndpoint({
        url,
        description: description.trim() || undefined,
      })
      handleCreateOpenChange(false)
      setSubmitting(false)
      setSecretEndpoint(created)
      await reload()
      toast.success('Endpoint created')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create endpoint')
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

  const createButton = (
    <Button
      size="sm"
      className="endpoint-panel-toolbar__create gap-1.5"
      onClick={() => setCreateOpen(true)}
      disabled={submitting}
    >
      <Plus className="size-3.5" aria-hidden="true" />
      {submitting ? 'Creating…' : 'Create endpoint'}
    </Button>
  )

  const endpointPanelChrome = (
    <div className="endpoint-panel-toolbar">
      <div className="endpoint-panel-toolbar__actions">{createButton}</div>
    </div>
  )

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
                  onPrevious={() =>
                    setOffset(Math.max(0, offset - API_PAGE_SIZE))
                  }
                  onNext={() => setOffset(offset + API_PAGE_SIZE)}
                />
              </div>
            ) : undefined
          }
        >
          {showEmpty ? null : endpointPanelChrome}
          {endpoints.length > 0 ? (
            <EndpointCatalogList
              endpoints={endpoints}
              togglingId={togglingId}
              onEdit={handleEditOpen}
              onToggle={handleToggleStatus}
            />
          ) : showEmpty ? (
            emptyState
          ) : null}
        </DataPanel>
      )}

      <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <div className="catalog-dialog-secret px-[clamp(1.25rem,4vw,var(--space-s2))] pt-[clamp(1.25rem,4vw,var(--space-s2))] pb-4">
            <DialogHeader className="gap-1.5 text-left">
              <DialogTitle className="catalog-dialog-secret__title">Create endpoint</DialogTitle>
              <DialogDescription className="catalog-dialog-secret__desc">
                Register a receiver URL. Signed webhook payloads are POSTed to this address.
              </DialogDescription>
            </DialogHeader>

            <form
              id="create-endpoint-form"
              className="mt-4 flex flex-col gap-4"
              onSubmit={handleCreate}
            >
              <SendEventField
                id="endpoint-url"
                label="URL"
                hint="Must accept POST requests."
                variant="plain"
              >
                <Input
                  id="endpoint-url"
                  type="url"
                  placeholder="https://example.com/webhooks"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  autoFocus
                  required
                />
              </SendEventField>
              <SendEventField
                id="endpoint-description"
                label="Label"
                hint="Optional label (e.g. Production, Staging)."
                variant="plain"
              >
                <Input
                  id="endpoint-description"
                  placeholder="e.g. Production"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </SendEventField>
            </form>
          </div>

          <DialogFooter className="mx-0 mb-0 mt-0 border-t border-border bg-muted/6 px-[clamp(1.25rem,4vw,var(--space-s2))] py-3">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => handleCreateOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button size="sm" type="submit" form="create-endpoint-form" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create endpoint'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open && !editSubmitting) {
            handleEditClose()
          }
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <div className="catalog-dialog-secret px-[clamp(1.25rem,4vw,var(--space-s2))] pt-[clamp(1.25rem,4vw,var(--space-s2))] pb-4">
            <DialogHeader className="gap-1.5 text-left">
              <DialogTitle className="catalog-dialog-secret__title">Edit label</DialogTitle>
              <DialogDescription className="catalog-dialog-secret__desc">
                Update the label. The receiver URL cannot be changed after creation.
              </DialogDescription>
            </DialogHeader>

            {editTarget ? (
              <form
                id="edit-endpoint-form"
                className="mt-4 flex flex-col gap-4"
                onSubmit={handleEdit}
              >
                <SendEventField
                  id="edit-endpoint-url"
                  label="URL"
                  hint="Cannot be changed after creation."
                  variant="plain"
                >
                  <p id="edit-endpoint-url" className="endpoint-locked-url" title={editTarget.url}>
                    {editTarget.url}
                  </p>
                </SendEventField>
                <SendEventField
                  id="edit-endpoint-description"
                  label="Label"
                  hint="Shown in the endpoint list (e.g. Production, Staging)."
                  variant="plain"
                >
                  <Input
                    id="edit-endpoint-description"
                    placeholder="e.g. Production"
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    autoFocus
                  />
                </SendEventField>
              </form>
            ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 mt-0 border-t border-border bg-muted/6 px-[clamp(1.25rem,4vw,var(--space-s2))] py-3">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={handleEditClose}
              disabled={editSubmitting}
            >
              Cancel
            </Button>
            <Button size="sm" type="submit" form="edit-endpoint-form" disabled={editSubmitting}>
              {editSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={secretEndpoint !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSecretEndpoint(null)
          }
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-lg">
          <div className="flex flex-col gap-4 px-[clamp(1.25rem,4vw,var(--space-s2))] pt-[clamp(1.25rem,4vw,var(--space-s2))] pb-4">
            <DialogHeader>
              <DialogTitle>Signing secret</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Copy this secret now. The server cannot show it again after you close this dialog.
              </DialogDescription>
            </DialogHeader>

            {secretEndpoint ? (
              <>
                <PageBanner
                  variant="info"
                  title="Shown once"
                  description="Use this value to verify webhook signatures. Treat it like a password."
                />

                <SettingsCopyValue
                  value={secretEndpoint.secret}
                  copyLabel="Secret"
                  buttonLabel="Copy"
                />
              </>
            ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 mt-0 border-t border-border bg-muted/6 px-[clamp(1.25rem,4vw,var(--space-s2))] py-3">
            <Button size="sm" type="button" onClick={() => setSecretEndpoint(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConsolePage>
  )
}
