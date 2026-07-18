import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Globe, Plus, Search } from 'lucide-react'
import {
  EndpointStatusTabs,
  type EndpointStatusTab,
} from '@/components/console/EndpointStatusTabs'
import { toast } from '@/lib/toast'
import { ApiError, createEndpoint, listEndpoints, patchEndpoint } from '@/api/client'
import type { Endpoint, EndpointWithSecret } from '@/api/types'
import { ConsolePage } from '@/components/console/ConsolePage'
import { DataPanel } from '@/components/console/DataPanel'
import {
  EndpointCatalogList,
  type EndpointRowLastDelivery,
} from '@/components/console/EndpointCatalogList'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { PaginationBar } from '@/components/console/PaginationBar'
import { DataPanelEmpty } from '@/components/console/DataPanelEmpty'
import { SendEventField } from '@/components/console/SendEventField'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import { CatalogInput } from '@/components/catalog/CatalogInput'
import { CatalogSecretReveal } from '@/components/catalog/CatalogSecretReveal'
import {
  CatalogSelect,
  CatalogSelectContent,
  CatalogSelectItem,
  CatalogSelectTrigger,
  CatalogSelectValue,
} from '@/components/catalog/CatalogSelect'
import {
  CatalogDialog,
  CatalogDialogContent,
  CatalogDialogDescription,
  CatalogDialogFooter,
  CatalogDialogHeader,
  CatalogDialogTitle,
} from '@/components/catalog/CatalogDialog'
import { saveEndpointSecret } from '@/lib/endpoint-vault'

const API_PAGE_SIZE = 25

const LABEL_OPTIONS = [
  { value: 'all', label: 'All labels' },
  { value: '__unlabeled', label: 'Unlabeled' },
] as const

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'url', label: 'URL (A–Z)' },
  { value: 'last_delivery', label: 'Last delivery' },
] as const
type LabelFilter = string
type SortOption = (typeof SORT_OPTIONS)[number]['value']

function buildLastDeliveryMap(endpoints: Endpoint[]): Record<string, EndpointRowLastDelivery> {
  const map: Record<string, EndpointRowLastDelivery> = {}

  for (const endpoint of endpoints) {
    const last = endpoint.last_delivery
    if (!last) continue
    map[endpoint.id] = {
      deliveryId: last.id,
      status: last.status,
      updatedAt: last.updated_at,
      error: last.last_error,
    }
  }

  return map
}

function matchesSearch(endpoint: Endpoint, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return (
    endpoint.url.toLowerCase().includes(normalized) ||
    endpoint.id.toLowerCase().includes(normalized) ||
    (endpoint.description?.toLowerCase().includes(normalized) ?? false)
  )
}

function matchesTab(
  endpoint: Endpoint,
  tab: EndpointStatusTab,
  lastDeliveries: Record<string, EndpointRowLastDelivery | null | undefined>,
): boolean {
  switch (tab) {
    case 'all':
      return true
    case 'active':
      return endpoint.status === 'active'
    case 'disabled':
      return endpoint.status === 'disabled'
    case 'failed':
      return lastDeliveries[endpoint.id]?.status === 'failed'
    default: {
      tab satisfies never
      return true
    }
  }
}

function countByTab(
  endpoints: Endpoint[],
  lastDeliveries: Record<string, EndpointRowLastDelivery | null | undefined>,
): Record<EndpointStatusTab, number> {
  return {
    all: endpoints.length,
    active: endpoints.filter((endpoint) => endpoint.status === 'active').length,
    disabled: endpoints.filter((endpoint) => endpoint.status === 'disabled').length,
    failed: endpoints.filter((endpoint) => lastDeliveries[endpoint.id]?.status === 'failed')
      .length,
  }
}

function matchesLabel(endpoint: Endpoint, labelFilter: LabelFilter): boolean {
  if (labelFilter === 'all') return true
  if (labelFilter === '__unlabeled') return !endpoint.description
  return endpoint.description === labelFilter
}

function sortEndpoints(
  endpoints: Endpoint[],
  sort: SortOption,
  lastDeliveries: Record<string, EndpointRowLastDelivery | null | undefined>,
): Endpoint[] {
  const next = [...endpoints]

  next.sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return Date.parse(a.created_at) - Date.parse(b.created_at)
      case 'url':
        return a.url.localeCompare(b.url)
      case 'last_delivery': {
        const aTime = lastDeliveries[a.id]?.updatedAt
        const bTime = lastDeliveries[b.id]?.updatedAt
        if (!aTime && !bTime) return 0
        if (!aTime) return 1
        if (!bTime) return -1
        return Date.parse(bTime) - Date.parse(aTime)
      }
      case 'newest':
      default:
        return Date.parse(b.created_at) - Date.parse(a.created_at)
    }
  })

  return next
}

type EndpointsListState = {
  endpoints: Endpoint[]
  total: number
  offset: number
  lastDeliveries: Record<string, EndpointRowLastDelivery>
  loading: boolean
  isInitial: boolean
  isRefreshing: boolean
  error: string | null
  togglingId: string | null
}

type EndpointsListAction =
  | { type: 'set_offset'; offset: number }
  | { type: 'refresh_start' }
  | { type: 'load_success'; endpoints: Endpoint[]; total: number; offset: number; lastDeliveries: Record<string, EndpointRowLastDelivery> }
  | { type: 'load_failure'; error: string }
  | { type: 'load_complete' }
  | { type: 'toggle_start'; id: string }
  | { type: 'toggle_end' }

function endpointsListReducer(
  state: EndpointsListState,
  action: EndpointsListAction,
): EndpointsListState {
  switch (action.type) {
    case 'set_offset':
      return { ...state, offset: action.offset }
    case 'refresh_start':
      return { ...state, isRefreshing: true }
    case 'load_success':
      return {
        ...state,
        endpoints: action.endpoints,
        total: action.total,
        offset: action.offset,
        lastDeliveries: action.lastDeliveries,
        error: null,
      }
    case 'load_failure':
      return { ...state, error: action.error }
    case 'load_complete':
      return { ...state, loading: false, isInitial: false, isRefreshing: false }
    case 'toggle_start':
      return { ...state, togglingId: action.id }
    case 'toggle_end':
      return { ...state, togglingId: null }
    default: {
      action satisfies never
      return state
    }
  }
}

type CreateDialogState = {
  createOpen: boolean
  url: string
  description: string
  submitting: boolean
}

type CreateDialogAction =
  | { type: 'set_create_open'; open: boolean }
  | { type: 'set_url'; value: string }
  | { type: 'set_description'; value: string }
  | { type: 'submit_start' }
  | { type: 'submit_success' }
  | { type: 'submit_end' }

const initialCreateDialogState: CreateDialogState = {
  createOpen: false,
  url: '',
  description: '',
  submitting: false,
}

function createDialogReducer(
  state: CreateDialogState,
  action: CreateDialogAction,
): CreateDialogState {
  switch (action.type) {
    case 'set_create_open':
      return action.open
        ? { ...state, createOpen: true }
        : { ...state, createOpen: false, url: '', description: '' }
    case 'set_url':
      return { ...state, url: action.value }
    case 'set_description':
      return { ...state, description: action.value }
    case 'submit_start':
      return { ...state, submitting: true }
    case 'submit_success':
      return { createOpen: false, url: '', description: '', submitting: false }
    case 'submit_end':
      return { ...state, submitting: false }
    default: {
      action satisfies never
      return state
    }
  }
}

type EditDialogState = {
  editTarget: Endpoint | null
  description: string
  submitting: boolean
}

type EditDialogAction =
  | { type: 'open'; endpoint: Endpoint }
  | { type: 'set_description'; value: string }
  | { type: 'submit_start' }
  | { type: 'close' }
  | { type: 'submit_end' }

const initialEditDialogState: EditDialogState = {
  editTarget: null,
  description: '',
  submitting: false,
}

function editDialogReducer(state: EditDialogState, action: EditDialogAction): EditDialogState {
  switch (action.type) {
    case 'open':
      return {
        editTarget: action.endpoint,
        description: action.endpoint.description ?? '',
        submitting: false,
      }
    case 'set_description':
      return { ...state, description: action.value }
    case 'submit_start':
      return { ...state, submitting: true }
    case 'close':
      return initialEditDialogState
    case 'submit_end':
      return { ...state, submitting: false }
    default: {
      action satisfies never
      return state
    }
  }
}

type SecretDialogState = {
  secretEndpoint: EndpointWithSecret | null
  saveToVault: boolean
}

type SecretDialogAction =
  | { type: 'show_secret'; endpoint: EndpointWithSecret }
  | { type: 'set_save_to_vault'; value: boolean }
  | { type: 'dismiss' }

const initialSecretDialogState: SecretDialogState = {
  secretEndpoint: null,
  saveToVault: false,
}

function secretDialogReducer(
  state: SecretDialogState,
  action: SecretDialogAction,
): SecretDialogState {
  switch (action.type) {
    case 'show_secret':
      return { secretEndpoint: action.endpoint, saveToVault: false }
    case 'set_save_to_vault':
      return { ...state, saveToVault: action.value }
    case 'dismiss':
      return { secretEndpoint: null, saveToVault: false }
    default: {
      action satisfies never
      return state
    }
  }
}

export function Endpoints() {
  const [listState, listDispatch] = useReducer(endpointsListReducer, {
    endpoints: [],
    total: 0,
    offset: 0,
    lastDeliveries: {},
    loading: true,
    isInitial: true,
    isRefreshing: false,
    error: null,
    togglingId: null,
  })
  const [createState, createDispatch] = useReducer(createDialogReducer, initialCreateDialogState)
  const [editState, editDispatch] = useReducer(editDialogReducer, initialEditDialogState)
  const [secretState, secretDispatch] = useReducer(secretDialogReducer, initialSecretDialogState)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusTab, setStatusTab] = useState<EndpointStatusTab>('all')
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all')
  const [sort, setSort] = useState<SortOption>('newest')

  const hasDataRef = useRef(false)

  const {
    endpoints,
    total,
    offset,
    lastDeliveries,
    isInitial,
    isRefreshing,
    error,
    togglingId,
  } = listState
  const { createOpen, url, description, submitting } = createState
  const { editTarget, description: editDescription, submitting: editSubmitting } = editState
  const { secretEndpoint, saveToVault } = secretState

  const loadEndpoints = useCallback(async (nextOffset: number, background = false) => {
    if (background) {
      listDispatch({ type: 'refresh_start' })
    }

    try {
      const endpointResult = await listEndpoints({ limit: API_PAGE_SIZE, offset: nextOffset })

      listDispatch({
        type: 'load_success',
        endpoints: endpointResult.data,
        total: endpointResult.total,
        offset: endpointResult.offset,
        lastDeliveries: buildLastDeliveryMap(endpointResult.data),
      })
      hasDataRef.current = true
    } catch (err) {
      listDispatch({
        type: 'load_failure',
        error: err instanceof ApiError ? err.message : 'Failed to load endpoints',
      })
    } finally {
      listDispatch({ type: 'load_complete' })
    }
  }, [])

  useEffect(() => {
    void loadEndpoints(offset, hasDataRef.current)
  }, [loadEndpoints, offset])

  const labelOptions = useMemo(() => {
    const labels = new Set<string>()
    for (const endpoint of endpoints) {
      if (endpoint.description) {
        labels.add(endpoint.description)
      }
    }
    return [
      ...LABEL_OPTIONS,
      ...[...labels].sort((a, b) => a.localeCompare(b)).map((label) => ({
        value: label,
        label,
      })),
    ]
  }, [endpoints])

  const tabSourceEndpoints = useMemo(() => {
    return endpoints.filter(
      (endpoint) =>
        matchesSearch(endpoint, searchQuery) && matchesLabel(endpoint, labelFilter),
    )
  }, [endpoints, searchQuery, labelFilter])

  const tabCounts = useMemo(
    () => countByTab(tabSourceEndpoints, lastDeliveries),
    [tabSourceEndpoints, lastDeliveries],
  )

  const filteredEndpoints = useMemo(() => {
    const filtered = tabSourceEndpoints.filter((endpoint) =>
      matchesTab(endpoint, statusTab, lastDeliveries),
    )
    return sortEndpoints(filtered, sort, lastDeliveries)
  }, [tabSourceEndpoints, statusTab, sort, lastDeliveries])

  const usesClientList =
    searchQuery.trim().length > 0 || labelFilter !== 'all' || statusTab !== 'all'

  const visibleEndpoints = filteredEndpoints

  const displayTotal = usesClientList ? filteredEndpoints.length : total
  const displayOffset = usesClientList ? 0 : offset

  const hasSearch = searchQuery.trim().length > 0
  const hasFilters = labelFilter !== 'all' || statusTab !== 'all'
  const showEmpty = !isInitial && filteredEndpoints.length === 0
  const isDatasetEmpty = showEmpty && !hasSearch && !hasFilters
  const showPanelChrome = !isDatasetEmpty
  const showLoading = isInitial && endpoints.length === 0

  const emptyState = useMemo(() => {
    if (hasSearch || hasFilters) {
      return (
        <DataPanelEmpty
          variant="inline"
          icon={Search}
          title="No endpoints match your filters"
          description="Try a different search term, status, or label."
        />
      )
    }

    return (
      <DataPanelEmpty
        icon={Globe}
        title="No endpoints yet"
        description={
          <>
            Register a URL where signed webhook payloads should be delivered.{' '}
            <button
              type="button" className="font-medium text-primary hover:underline"
              onClick={() => createDispatch({ type: 'set_create_open', open: true })}
            >
              Create your first endpoint
            </button>
            .
          </>
        }
      />
    )
  }, [hasSearch, hasFilters])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createDispatch({ type: 'submit_start' })

    try {
      const created = await createEndpoint({
        url,
        description: description.trim() || undefined,
      })
      createDispatch({ type: 'submit_success' })
      secretDispatch({ type: 'show_secret', endpoint: created })
      await loadEndpoints(offset, true)
      toast.success('Endpoint created')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create endpoint')
      createDispatch({ type: 'submit_end' })
    }
  }

  async function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editTarget) return

    editDispatch({ type: 'submit_start' })

    try {
      await patchEndpoint(editTarget.id, {
        description: editDescription.trim() || undefined,
      })
      editDispatch({ type: 'close' })
      await loadEndpoints(offset, true)
      toast.success('Endpoint updated')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update endpoint')
      editDispatch({ type: 'submit_end' })
    }
  }

  function handleSecretDismiss() {
    if (secretEndpoint && saveToVault) {
      saveEndpointSecret(secretEndpoint.id, secretEndpoint.secret)
      toast.success('Secret saved for this browser session')
    }
    secretDispatch({ type: 'dismiss' })
  }

  async function copySecret() {
    if (!secretEndpoint) {
      return
    }
    await navigator.clipboard.writeText(secretEndpoint.secret)
    toast.success('Secret copied')
  }

  async function handleToggleStatus(endpoint: Endpoint) {
    const nextStatus = endpoint.status === 'active' ? 'disabled' : 'active'
    listDispatch({ type: 'toggle_start', id: endpoint.id })

    try {
      await patchEndpoint(endpoint.id, { status: nextStatus })
      await loadEndpoints(offset, true)
      toast.success(nextStatus === 'active' ? 'Endpoint enabled' : 'Endpoint disabled')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update endpoint')
    } finally {
      listDispatch({ type: 'toggle_end' })
    }
  }

  const pageStart = displayTotal === 0 ? 0 : displayOffset + 1
  const pageEnd = usesClientList
    ? Math.min(displayOffset + visibleEndpoints.length, displayTotal)
    : Math.min(displayOffset + endpoints.length, displayTotal)
  const canGoBack = !usesClientList && offset > 0
  const canGoForward = !usesClientList && offset + API_PAGE_SIZE < displayTotal
  const showFooter = !isInitial && displayTotal > 0

  const createButton = (
    <CatalogButton size="sm" className="endpoint-panel-toolbar__create gap-1.5"
      onClick={() => createDispatch({ type: 'set_create_open', open: true })}
      disabled={submitting}
    >
      <Plus className="size-3.5" aria-hidden="true" />
      {submitting ? 'Creating…' : 'Create endpoint'}
    </CatalogButton>
  )

  const endpointPanelChrome = (
    <>
      <div className="endpoint-panel-toolbar" role="search" aria-label="Filter endpoints">
        <div className="endpoint-panel-toolbar__search">
          <Search className="endpoint-panel-toolbar__search-icon" aria-hidden="true" />
          <CatalogInput
            type="search"
            placeholder="Search endpoints by URL, ID, or label…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)} className="endpoint-panel-toolbar__search-input"
            aria-label="Search endpoints"
          />
        </div>

        <div className="endpoint-panel-toolbar__filters" role="group" aria-label="Endpoint filters">
          <CatalogSelect value={labelFilter} onValueChange={setLabelFilter}>
            <CatalogSelectTrigger className="endpoint-panel-toolbar__filter">
              <CatalogSelectValue placeholder="Label" />
            </CatalogSelectTrigger>
            <CatalogSelectContent>
              {labelOptions.map((option) => (
                <CatalogSelectItem key={option.value} value={option.value}>
                  {option.label}
                </CatalogSelectItem>
              ))}
            </CatalogSelectContent>
          </CatalogSelect>

          <CatalogSelect value={sort} onValueChange={(value) => setSort(value as SortOption)}>
            <CatalogSelectTrigger className="endpoint-panel-toolbar__filter">
              <CatalogSelectValue placeholder="Sort" />
            </CatalogSelectTrigger>
            <CatalogSelectContent>
              {SORT_OPTIONS.map((option) => (
                <CatalogSelectItem key={option.value} value={option.value}>
                  {option.label}
                </CatalogSelectItem>
              ))}
            </CatalogSelectContent>
          </CatalogSelect>
        </div>

        <div className="endpoint-panel-toolbar__actions">{createButton}</div>
      </div>

      <EndpointStatusTabs activeTab={statusTab} counts={tabCounts} onChange={setStatusTab} />
    </>
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
        <DataPanel className="endpoint-panel"
          loading={isRefreshing}
          footer={
            showFooter ? (
              <div className="pagination-bar-footer">
                <PaginationBar
                  pageStart={pageStart}
                  pageEnd={pageEnd}
                  total={displayTotal}
                  pageSize={API_PAGE_SIZE}
                  canGoBack={canGoBack}
                  canGoForward={canGoForward}
                  onPrevious={() =>
                    listDispatch({ type: 'set_offset', offset: Math.max(0, offset - API_PAGE_SIZE) })
                  }
                  onNext={() =>
                    listDispatch({ type: 'set_offset', offset: offset + API_PAGE_SIZE })
                  }
                />
              </div>
            ) : undefined
          }
        >
          {showPanelChrome ? endpointPanelChrome : null}
          {visibleEndpoints.length > 0 ? (
            <EndpointCatalogList
              endpoints={visibleEndpoints}
              lastDeliveries={lastDeliveries}
              togglingId={togglingId}
              onEdit={(endpoint) => editDispatch({ type: 'open', endpoint })}
              onToggle={handleToggleStatus}
            />
          ) : showEmpty ? (
            emptyState
          ) : null}
        </DataPanel>
      )}

      <CatalogDialog
        open={createOpen}
        onOpenChange={(open) => createDispatch({ type: 'set_create_open', open })}
      >
        <CatalogDialogContent className="gap-0 p-0 sm:max-w-md">
          <div className="catalog-dialog-secret px-[clamp(1.25rem,4vw,var(--space-s2))] pt-[clamp(1.25rem,4vw,var(--space-s2))] pb-4">
            <CatalogDialogHeader className="gap-1.5 text-left">
              <CatalogDialogTitle className="catalog-dialog-secret__title">
                Create endpoint
              </CatalogDialogTitle>
              <CatalogDialogDescription className="catalog-dialog-secret__desc">
                Register a receiver URL. Signed webhook payloads are POSTed to this address.
              </CatalogDialogDescription>
            </CatalogDialogHeader>

            <form
              id="create-endpoint-form" className="mt-4 flex flex-col gap-4"
              onSubmit={handleCreate}
            >
              <SendEventField
                id="endpoint-url"
                label="URL"
                hint="Must accept POST requests."
                variant="plain"
              >
                <CatalogInput
                  id="endpoint-url"
                  type="url"
                  placeholder="https://example.com/webhooks"
                  value={url}
                  onChange={(event) => createDispatch({ type: 'set_url', value: event.target.value })}
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
                <CatalogInput
                  id="endpoint-description"
                  placeholder="e.g. Production"
                  value={description}
                  onChange={(event) =>
                    createDispatch({ type: 'set_description', value: event.target.value })
                  }
                />
              </SendEventField>
            </form>
          </div>

          <CatalogDialogFooter className="mx-0 mb-0 mt-0 border-t border-border bg-muted/[0.06] px-[clamp(1.25rem,4vw,var(--space-s2))] py-3">
            <CatalogButton size="sm"
              type="button"
              variant="secondary"
              onClick={() => createDispatch({ type: 'set_create_open', open: false })}
              disabled={submitting}
            >
              Cancel
            </CatalogButton>
            <CatalogButton size="sm"
              type="submit"
              form="create-endpoint-form"
              disabled={submitting}
            >
              {submitting ? 'Creating…' : 'Create endpoint'}
            </CatalogButton>
          </CatalogDialogFooter>
        </CatalogDialogContent>
      </CatalogDialog>

      <CatalogDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open && !editSubmitting) {
            editDispatch({ type: 'close' })
          }
        }}
      >
        <CatalogDialogContent className="gap-0 p-0 sm:max-w-md">
          <div className="catalog-dialog-secret px-[clamp(1.25rem,4vw,var(--space-s2))] pt-[clamp(1.25rem,4vw,var(--space-s2))] pb-4">
            <CatalogDialogHeader className="gap-1.5 text-left">
              <CatalogDialogTitle className="catalog-dialog-secret__title">
                Edit label
              </CatalogDialogTitle>
              <CatalogDialogDescription className="catalog-dialog-secret__desc">
                Update the label. The receiver URL cannot be changed after creation.
              </CatalogDialogDescription>
            </CatalogDialogHeader>

            {editTarget ? (
              <form
                id="edit-endpoint-form" className="mt-4 flex flex-col gap-4"
                onSubmit={handleEdit}
              >
                <SendEventField
                  id="edit-endpoint-url"
                  label="URL"
                  hint="Cannot be changed after creation."
                  variant="plain"
                >
                  <p
                    id="edit-endpoint-url" className="endpoint-locked-url"
                    title={editTarget.url}
                  >
                    {editTarget.url}
                  </p>
                </SendEventField>
                <SendEventField
                  id="edit-endpoint-description"
                  label="Label"
                  hint="Shown in the endpoint list (e.g. Production, Staging)."
                  variant="plain"
                >
                  <CatalogInput
                    id="edit-endpoint-description"
                    placeholder="e.g. Production"
                    value={editDescription}
                    onChange={(event) =>
                      editDispatch({ type: 'set_description', value: event.target.value })
                    }
                    autoFocus
                  />
                </SendEventField>
              </form>
            ) : null}
          </div>

          <CatalogDialogFooter className="mx-0 mb-0 mt-0 border-t border-border bg-muted/[0.06] px-[clamp(1.25rem,4vw,var(--space-s2))] py-3">
            <CatalogButton size="sm"
              type="button"
              variant="secondary"
              onClick={() => editDispatch({ type: 'close' })}
              disabled={editSubmitting}
            >
              Cancel
            </CatalogButton>
            <CatalogButton size="sm"
              type="submit"
              form="edit-endpoint-form"
              disabled={editSubmitting}
            >
              {editSubmitting ? 'Saving…' : 'Save changes'}
            </CatalogButton>
          </CatalogDialogFooter>
        </CatalogDialogContent>
      </CatalogDialog>

      <CatalogDialog
        open={secretEndpoint !== null}
        onOpenChange={(open) => {
          if (!open) {
            handleSecretDismiss()
          }
        }}
      >
        <CatalogDialogContent className="sm:max-w-lg">
          <CatalogDialogHeader>
            <CatalogDialogTitle>Signing secret</CatalogDialogTitle>
            <CatalogDialogDescription className="text-muted-strong">
              Copy this secret now. The server cannot show it again after you close this dialog.
            </CatalogDialogDescription>
          </CatalogDialogHeader>

          {secretEndpoint ? (
            <div className="flex flex-col gap-4">
              <CatalogSecretReveal
                value={secretEndpoint.secret}
                onCopy={() => void copySecret()}
                copyLabel="Copy secret"
                hint="Use this value to verify webhook signatures."
              />

              <label className="flex cursor-pointer items-start gap-3 border border-border bg-surface px-4 py-3 transition-colors hover:bg-background-alt">
                <input
                  type="checkbox" className="mt-1 shrink-0"
                  checked={saveToVault}
                  onChange={(event) =>
                    secretDispatch({ type: 'set_save_to_vault', value: event.target.checked })
                  }
                />
                <span className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Save for this session</span>
                  <span className="text-muted-strong">
                    Kept in memory for this browser tab session only (lost on refresh). The server
                    never keeps a copy.
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          <CatalogDialogFooter>
            <CatalogButton size="sm" onClick={handleSecretDismiss}>Done</CatalogButton>
          </CatalogDialogFooter>
        </CatalogDialogContent>
      </CatalogDialog>
    </ConsolePage>
  )
}
