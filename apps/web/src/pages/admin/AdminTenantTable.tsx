import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronDown, Pencil, Trash2, Users } from 'lucide-react'
import { ApiError, deleteAdminTenant } from '@/api/client'
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
import { pageRange, shouldPaginate } from '@/components/console/pagination-utils'
import { SettingsCopyAction } from '@/components/console/SettingsCatalog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
  hasMore: boolean
  offset: number
  loading: boolean
  onOffsetChange: (offset: number) => void
  onRefresh: () => void
  searchQuery?: string
}

export function AdminTenantTable({
  tenants,
  hasMore,
  offset,
  loading,
  onOffsetChange,
  onRefresh,
  searchQuery,
}: AdminTenantTableProps) {
  const [renameTarget, setRenameTarget] = useState<AdminTenant | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminTenant | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const { pageStart, pageEnd } = pageRange(offset, tenants.length)
  const canGoBack = offset > 0
  const canGoForward = hasMore
  const isSearching = searchQuery && searchQuery.trim().length > 0

  const emptyMessage = isSearching
    ? `No tenants matching "${searchQuery}". Try a different search term.`
    : 'No tenants yet. Invite the first tenant owner.'

  if (loading && tenants.length === 0) {
    return <PageLoading variant="table" />
  }

  return (
    <DataPanel
      title="Tenant directory"
      loading={loading && tenants.length > 0}
      empty={!loading && tenants.length === 0 ? emptyMessage : undefined}
      footer={
        !loading && shouldPaginate(hasMore, offset) ? (
          <PaginationBar
            pageStart={pageStart}
            pageEnd={pageEnd}
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
              <DataTableHead className="admin-tenant-table__col-created hidden sm:table-cell">
                Created
              </DataTableHead>
              <DataTableHead className="admin-tenant-table__col-actions text-left">
                Actions
              </DataTableHead>
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
                <DataTableCell className="admin-tenant-table__col-created hidden text-sm text-muted-foreground sm:table-cell">
                  {formatDateTime(tenant.created_at)}
                </DataTableCell>
                <DataTableCell className="admin-tenant-table__col-actions text-left">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="inline-flex items-center gap-1"
                        aria-label={`Manage ${tenant.name}`}
                      >
                        Manage
                        <ChevronDown className="size-3.5" aria-hidden="true" />
                      </Button>
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

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && deletingId === null) {
            setDeleteTarget(null)
            setDeleteConfirmation('')
          }
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            cancelDeleteRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-status-danger" />
              Delete tenant
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will
              permanently remove the tenant, all its users, API keys, endpoints, events, and
              delivery history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-tenant-confirmation">
              Type <strong>{deleteTarget?.name}</strong> to confirm
            </Label>
            <Input
              id="delete-tenant-confirmation"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              disabled={deletingId !== null}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              size="sm"
              ref={cancelDeleteRef}
              variant="secondary"
              onClick={() => {
                setDeleteTarget(null)
                setDeleteConfirmation('')
              }}
              disabled={deletingId !== null}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-status-danger text-white hover:bg-status-danger/90"
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
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DataPanel>
  )
}
