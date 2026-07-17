import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronDown, CirclePause, Pencil, Play, Trash2, Users } from 'lucide-react'
import { ApiError, deleteAdminTenant, suspendAdminTenant, unsuspendAdminTenant } from '@/api/client'
import type { AdminTenant } from '@/api/types'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/console/DataTable'
import { DataPanel } from '@/components/console/DataPanel'
import { PageLoading } from '@/components/console/PageLoading'
import { PaginationBar } from '@/components/console/PaginationBar'
import { SettingsCopyAction } from '@/components/console/SettingsCatalog'
import { StatusBadge } from '@/components/console/StatusBadge'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import {
  CatalogDialog,
  CatalogDialogContent,
  CatalogDialogDescription,
  CatalogDialogFooter,
  CatalogDialogHeader,
  CatalogDialogTitle,
} from '@/components/catalog/CatalogDialog'
import { CatalogInput } from '@/components/catalog/CatalogInput'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import { AdminRenameTenantDialog } from '@/pages/admin/AdminRenameTenantDialog'

const PAGE_SIZE = 25

type AdminTenantTableProps = {
  tenants: AdminTenant[]
  total: number
  offset: number
  loading: boolean
  onOffsetChange: (offset: number) => void
  onRefresh: () => void
  searchQuery?: string
}

export function AdminTenantTable({
  tenants,
  total,
  offset,
  loading,
  onOffsetChange,
  onRefresh,
  searchQuery,
}: AdminTenantTableProps) {
  const [renameTarget, setRenameTarget] = useState<AdminTenant | null>(null)
  const [statusTarget, setStatusTarget] = useState<AdminTenant | null>(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminTenant | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + tenants.length, total)
  const canGoBack = offset > 0
  const canGoForward = offset + PAGE_SIZE < total
  const isSearching = searchQuery && searchQuery.trim().length > 0

  const emptyMessage = isSearching
    ? `No tenants matching "${searchQuery}". Try a different search term.`
    : 'No tenants yet. Create the first tenant and owner account.'

  if (loading && tenants.length === 0) {
    return <PageLoading variant="table" />
  }

  return (
    <DataPanel
      title="Tenant directory"
      loading={loading && tenants.length > 0}
      empty={!loading && tenants.length === 0 ? emptyMessage : undefined}
      footer={
        !loading && total > 0 ? (
          <PaginationBar
            pageStart={pageStart}
            pageEnd={pageEnd}
            total={total}
            pageSize={PAGE_SIZE}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onPrevious={() => onOffsetChange(Math.max(0, offset - PAGE_SIZE))}
            onNext={() => onOffsetChange(offset + PAGE_SIZE)}
          />
        ) : undefined
      }
    >
      {tenants.length > 0 ? (
        <DataTable className="admin-tenant-table">
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead className="admin-tenant-table__col-name">Tenant</DataTableHead>
              <DataTableHead className="admin-tenant-table__col-id hidden md:table-cell">
                Tenant ID
              </DataTableHead>
              <DataTableHead className="admin-tenant-table__col-status">Status</DataTableHead>
              <DataTableHead className="admin-tenant-table__col-created hidden sm:table-cell">
                Created
              </DataTableHead>
              <DataTableHead className="admin-tenant-table__col-actions">Actions</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {tenants.map((tenant) => (
              <DataTableRow key={tenant.id}>
                <DataTableCell className="admin-tenant-table__col-name font-medium text-foreground">
                  <span className="block truncate" title={tenant.name}>
                    {tenant.name}
                  </span>
                </DataTableCell>
                <DataTableCell className="admin-tenant-table__col-id hidden md:table-cell">
                  <div className="flex min-w-0 items-center gap-1">
                    <code
                      className="truncate font-mono text-xs text-muted-strong"
                      title={tenant.id}
                    >
                      {tenant.id.slice(0, 8)}…{tenant.id.slice(-4)}
                    </code>
                    <SettingsCopyAction value={tenant.id} copyLabel="Tenant ID" />
                  </div>
                </DataTableCell>
                <DataTableCell className="admin-tenant-table__col-status">
                  <StatusBadge
                    kind="label"
                    label={tenant.status === 'active' ? 'Active' : 'Suspended'}
                    tone={tenant.status === 'active' ? 'success' : 'warning'}
                  />
                </DataTableCell>
                <DataTableCell className="admin-tenant-table__col-created hidden text-sm text-muted-foreground sm:table-cell">
                  {formatDateTime(tenant.created_at)}
                </DataTableCell>
                <DataTableCell className="admin-tenant-table__col-actions">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <CatalogButton
                        variant="secondary"
                        className="inline-flex h-[1.875rem] min-h-0 items-center gap-1 px-2.5 text-xs"
                        aria-label={`Manage ${tenant.name}`}
                      >
                        Manage
                        <ChevronDown className="size-3.5" aria-hidden="true" />
                      </CatalogButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      <DropdownMenuItem onSelect={() => setRenameTarget(tenant)}>
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Rename tenant
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/admin/tenants/${tenant.id}`}>
                          <Users className="size-3.5" aria-hidden="true" />
                          Manage users
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setStatusTarget(tenant)}>
                        {tenant.status === 'active' ? (
                          <CirclePause className="size-3.5" aria-hidden="true" />
                        ) : (
                          <Play className="size-3.5" aria-hidden="true" />
                        )}
                        {tenant.status === 'active' ? 'Suspend tenant' : 'Reactivate tenant'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          setDeleteConfirmation('')
                          setDeleteTarget(tenant)
                        }}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Delete tenant
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      ) : null}

      <AdminRenameTenantDialog
        open={renameTarget !== null}
        tenant={renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
        onRenamed={() => onRefresh()}
      />

      <CatalogDialog
        open={statusTarget !== null}
        onOpenChange={(open) => {
          if (!open && statusUpdatingId === null) setStatusTarget(null)
        }}
      >
        <CatalogDialogContent className="sm:max-w-md">
          <CatalogDialogHeader>
            <CatalogDialogTitle>
              {statusTarget?.status === 'active' ? 'Suspend tenant' : 'Reactivate tenant'}
            </CatalogDialogTitle>
            <CatalogDialogDescription className="text-muted-foreground">
              {statusTarget?.status === 'active'
                ? `Suspend ${statusTarget.name}? Its users and API keys will be blocked until the tenant is reactivated.`
                : `Reactivate ${statusTarget?.name}? Its users and API keys will regain access immediately.`}
            </CatalogDialogDescription>
          </CatalogDialogHeader>
          <CatalogDialogFooter>
            <CatalogButton
              variant="secondary"
              onClick={() => setStatusTarget(null)}
              disabled={statusUpdatingId !== null}
              className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
            >
              Cancel
            </CatalogButton>
            <CatalogButton
              disabled={statusTarget === null || statusUpdatingId !== null}
              className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
              onClick={async () => {
                if (!statusTarget) return
                setStatusUpdatingId(statusTarget.id)
                try {
                  if (statusTarget.status === 'active') {
                    await suspendAdminTenant(statusTarget.id)
                    toast.success('Tenant suspended')
                  } else {
                    await unsuspendAdminTenant(statusTarget.id)
                    toast.success('Tenant reactivated')
                  }
                  setStatusTarget(null)
                  onRefresh()
                } catch (err) {
                  toast.error(
                    err instanceof ApiError ? err.message : 'Failed to update tenant status',
                  )
                } finally {
                  setStatusUpdatingId(null)
                }
              }}
            >
              {statusUpdatingId !== null
                ? 'Updating…'
                : statusTarget?.status === 'active'
                  ? 'Suspend'
                  : 'Reactivate'}
            </CatalogButton>
          </CatalogDialogFooter>
        </CatalogDialogContent>
      </CatalogDialog>

      <CatalogDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && deletingId === null) {
            setDeleteTarget(null)
            setDeleteConfirmation('')
          }
        }}
      >
        <CatalogDialogContent
          className="sm:max-w-md"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            cancelDeleteRef.current?.focus()
          }}
        >
          <CatalogDialogHeader>
            <CatalogDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-status-danger" />
              Delete tenant
            </CatalogDialogTitle>
            <CatalogDialogDescription className="text-muted-foreground">
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will
              permanently remove the tenant, all its users, API keys, endpoints, events, and
              delivery history. This cannot be undone.
            </CatalogDialogDescription>
          </CatalogDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-tenant-confirmation">
              Type <strong>{deleteTarget?.name}</strong> to confirm
            </Label>
            <CatalogInput
              id="delete-tenant-confirmation"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              disabled={deletingId !== null}
              autoComplete="off"
            />
          </div>
          <CatalogDialogFooter>
            <CatalogButton
              ref={cancelDeleteRef}
              variant="secondary"
              onClick={() => {
                setDeleteTarget(null)
                setDeleteConfirmation('')
              }}
              disabled={deletingId !== null}
              className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
            >
              Cancel
            </CatalogButton>
            <CatalogButton
              className="bg-status-danger text-white hover:bg-status-danger/90 h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
              disabled={
                deletingId !== null ||
                deleteTarget === null ||
                deleteConfirmation !== deleteTarget.name
              }
              onClick={async () => {
                if (!deleteTarget || deleteConfirmation !== deleteTarget.name) return
                setDeletingId(deleteTarget.id)
                try {
                  await deleteAdminTenant(deleteTarget.id)
                  toast.success('Tenant deleted')
                  setDeleteTarget(null)
                  setDeleteConfirmation('')
                  onRefresh()
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : 'Failed to delete tenant')
                } finally {
                  setDeletingId(null)
                }
              }}
            >
              {deletingId !== null ? 'Deleting…' : 'Delete tenant'}
            </CatalogButton>
          </CatalogDialogFooter>
        </CatalogDialogContent>
      </CatalogDialog>
    </DataPanel>
  )
}
