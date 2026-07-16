import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Pencil, Trash2, Users } from 'lucide-react'
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
    ? `No tenants matching "${searchQuery}" on this page. Try a different search term or navigate to other pages.`
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
        <DataTable>
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead>Tenant</DataTableHead>
              <DataTableHead className="hidden md:table-cell">Tenant ID</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead>Created</DataTableHead>
              <DataTableHead className="text-right">Actions</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {tenants.map((tenant) => (
              <DataTableRow key={tenant.id}>
                <DataTableCell className="font-medium text-foreground">{tenant.name}</DataTableCell>
                <DataTableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <code className="font-mono text-xs text-muted-strong" title={tenant.id}>
                      {tenant.id.slice(0, 8)}…{tenant.id.slice(-4)}
                    </code>
                    <SettingsCopyAction value={tenant.id} copyLabel="Tenant ID" />
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge kind="label" label="Active" tone="success" />
                </DataTableCell>
                <DataTableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDateTime(tenant.created_at)}
                </DataTableCell>
                <DataTableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <CatalogButton
                      variant="secondary"
                      className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
                      onClick={() => setRenameTarget(tenant)}
                    >
                      <Pencil className="mr-1 size-3" />
                      Rename
                    </CatalogButton>
                    <CatalogButton variant="secondary" className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]" asChild>
                      <Link to={`/admin/tenants/${tenant.id}`}>
                        <Users className="mr-2 size-3.5" />
                        Users
                      </Link>
                    </CatalogButton>
                    <CatalogButton
                      variant="secondary"
                      className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem] text-status-danger hover:text-status-danger"
                      onClick={() => {
                        setDeleteConfirmation('')
                        setDeleteTarget(tenant)
                      }}
                    >
                      <Trash2 className="mr-1 size-3" />
                      Delete
                    </CatalogButton>
                  </div>
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
