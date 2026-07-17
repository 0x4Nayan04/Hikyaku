import { useCallback, useEffect, useState } from 'react'
import { Link2, Trash2 } from 'lucide-react'
import { ApiError, deleteOperator, listOperators } from '@/api/client'
import type { PlatformOperator } from '@/api/types'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import {
  CatalogDialog,
  CatalogDialogContent,
  CatalogDialogDescription,
  CatalogDialogFooter,
  CatalogDialogHeader,
  CatalogDialogTitle,
} from '@/components/catalog/CatalogDialog'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/console/DataTable'
import { DataPanel } from '@/components/console/DataPanel'
import { ConsolePage } from '@/components/console/ConsolePage'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { PaginationBar } from '@/components/console/PaginationBar'
import { InviteUrlDialog } from '@/components/invites/InviteUrlDialog'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import { useSession } from '@/providers/session-context'
import { AdminInviteOperatorDialog } from './AdminInviteOperatorDialog'

const PAGE_SIZE = 25

export function AdminOperators() {
  const { session } = useSession()
  const [operators, setOperators] = useState<PlatformOperator[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteResult, setInviteResult] = useState<{
    inviteUrl: string
    expiresAt: string
  } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PlatformOperator | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadOperators = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listOperators({ limit: PAGE_SIZE, offset })
      setOperators(result.data)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load operators')
    } finally {
      setLoading(false)
    }
  }, [offset])

  useEffect(() => {
    void loadOperators()
  }, [loadOperators])

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteOperator(pendingDelete.id)
      setPendingDelete(null)
      toast.success('Operator removed')
      await loadOperators()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to remove operator')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ConsolePage
      marker="Platform · Admin"
      title="Operators"
      description="Invite and manage platform administrators."
      actions={
        <button
          type="button"
          className="console-btn inline-flex items-center gap-2 border border-primary bg-primary px-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          onClick={() => setInviteOpen(true)}
        >
          <Link2 className="size-4" strokeWidth={1.75} />
          Invite operator
        </button>
      }
    >
      {error ? (
        <PageBanner variant="error" title="Could not load operators" description={error} />
      ) : null}
      {loading && operators.length === 0 ? (
        <PageLoading variant="table" />
      ) : (
        <DataPanel
          title="Platform operators"
          description={`${total.toLocaleString()} operators`}
          loading={loading}
          empty={operators.length === 0 ? 'No platform operators yet.' : undefined}
          footer={
            operators.length > 0 ? (
              <PaginationBar
                pageStart={offset + 1}
                pageEnd={Math.min(offset + operators.length, total)}
                total={total}
                pageSize={PAGE_SIZE}
                canGoBack={offset > 0}
                canGoForward={offset + operators.length < total}
                onPrevious={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
                onNext={() => setOffset((value) => value + PAGE_SIZE)}
              />
            ) : undefined
          }
        >
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Name</DataTableHead>
                <DataTableHead>Email</DataTableHead>
                <DataTableHead>Created</DataTableHead>
                <DataTableHead className="text-right">Actions</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {operators.map((operator) => {
                const isSelf = session?.user.id === operator.id
                const cannotDelete = isSelf || total <= 1
                return (
                  <DataTableRow key={operator.id}>
                    <DataTableCell className="font-medium text-ink">{operator.name}</DataTableCell>
                    <DataTableCell className="font-mono text-xs text-muted-strong">
                      {operator.email}
                    </DataTableCell>
                    <DataTableCell className="whitespace-nowrap text-muted-strong">
                      {formatDateTime(operator.created_at)}
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <CatalogButton
                        variant="secondary"
                        className="h-8 min-h-0 px-2.5 text-xs text-status-danger"
                        disabled={cannotDelete}
                        title={
                          isSelf
                            ? 'You cannot remove your own operator account'
                            : total <= 1
                              ? 'The last platform operator cannot be removed'
                              : undefined
                        }
                        onClick={() => setPendingDelete(operator)}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Remove
                      </CatalogButton>
                    </DataTableCell>
                  </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTable>
        </DataPanel>
      )}

      <AdminInviteOperatorDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={(result) => {
          setInviteResult(result)
          void loadOperators()
        }}
      />
      <InviteUrlDialog
        open={inviteResult !== null}
        onOpenChange={(open) => {
          if (!open) setInviteResult(null)
        }}
        inviteUrl={inviteResult?.inviteUrl ?? null}
        expiresAt={inviteResult?.expiresAt ?? null}
      />

      <CatalogDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null)
        }}
      >
        <CatalogDialogContent className="sm:max-w-md">
          <CatalogDialogHeader>
            <CatalogDialogTitle>Remove operator</CatalogDialogTitle>
            <CatalogDialogDescription className="text-muted-strong">
              Remove {pendingDelete?.email}? They will lose platform admin access immediately.
            </CatalogDialogDescription>
          </CatalogDialogHeader>
          <CatalogDialogFooter>
            <CatalogButton
              type="button"
              variant="secondary"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </CatalogButton>
            <CatalogButton
              type="button"
              disabled={deleting}
              className="bg-status-danger text-white hover:bg-status-danger/90"
              onClick={() => void handleDelete()}
            >
              {deleting ? 'Removing…' : 'Remove'}
            </CatalogButton>
          </CatalogDialogFooter>
        </CatalogDialogContent>
      </CatalogDialog>
    </ConsolePage>
  )
}
