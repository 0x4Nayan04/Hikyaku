import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { SignupRequest } from '@/api/types'
import {
  CatalogDialog,
  CatalogDialogContent,
  CatalogDialogDescription,
  CatalogDialogFooter,
  CatalogDialogHeader,
  CatalogDialogTitle,
} from '@/components/catalog/CatalogDialog'
import { CatalogButton } from '@/components/catalog/CatalogButton'
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
import { StatusBadge } from '@/components/console/StatusBadge'
import { formatDateTime } from '@/lib/format'

type AdminSignupRequestsTableProps = {
  requests: SignupRequest[]
  loading: boolean
  actingId: string | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

export function AdminSignupRequestsTable({
  requests,
  loading,
  actingId,
  onApprove,
  onReject,
}: AdminSignupRequestsTableProps) {
  const [pendingReject, setPendingReject] = useState<SignupRequest | null>(null)

  if (loading && requests.length === 0) {
    return <PageLoading variant="table" />
  }

  return (
    <>
      <DataPanel
        title={`Pending signups (${requests.length})`}
        className="border-status-warning-border"
        empty={
          !loading && requests.length === 0
            ? 'No pending signup requests. New self-service requests will appear here.'
            : undefined
        }
      >
        {requests.length > 0 ? (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Tenant</DataTableHead>
                <DataTableHead>Owner</DataTableHead>
                <DataTableHead className="hidden md:table-cell">Email</DataTableHead>
                <DataTableHead>Requested</DataTableHead>
                <DataTableHead className="text-right">Actions</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {requests.map((request) => {
                const isActing = actingId === request.id

                return (
                  <DataTableRow key={request.id}>
                    <DataTableCell className="font-medium text-foreground">
                      <div className="flex flex-col gap-1">
                        <span>{request.tenant_name}</span>
                        <StatusBadge kind="signup" status="pending" />
                      </div>
                    </DataTableCell>
                    <DataTableCell>{request.name}</DataTableCell>
                    <DataTableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {request.email}
                    </DataTableCell>
                    <DataTableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(request.created_at)}
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <CatalogButton
                          size="sm"
                          variant="secondary"
                          disabled={isActing}
                          onClick={() => setPendingReject(request)}
                        >
                          <X className="mr-1 size-3.5" />
                          Reject
                        </CatalogButton>
                        <CatalogButton
                          size="sm"
                          disabled={isActing}
                          onClick={() => onApprove(request.id)}
                        >
                          <Check className="mr-1 size-3.5" />
                          {isActing ? 'Working…' : 'Approve'}
                        </CatalogButton>
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTable>
        ) : null}
      </DataPanel>

      <CatalogDialog
        open={pendingReject !== null}
        onOpenChange={(open) => {
          if (!open && actingId === null) {
            setPendingReject(null)
          }
        }}
      >
        <CatalogDialogContent className="sm:max-w-md">
          <CatalogDialogHeader>
            <CatalogDialogTitle>Reject signup request?</CatalogDialogTitle>
            <CatalogDialogDescription className="text-muted-foreground">
              Reject {pendingReject?.email}&apos;s request for {pendingReject?.tenant_name}? The
              requester will not be told why, and they will need a new invite or signup to try
              again.
            </CatalogDialogDescription>
          </CatalogDialogHeader>
          <CatalogDialogFooter>
            <CatalogButton
              size="sm"
              type="button"
              variant="secondary"
              disabled={actingId !== null}
              onClick={() => setPendingReject(null)}
            >
              Cancel
            </CatalogButton>
            <CatalogButton
              size="sm"
              type="button"
              disabled={actingId !== null || pendingReject === null}
              className="bg-status-danger text-white hover:bg-status-danger/90"
              onClick={() => {
                if (!pendingReject) return
                const id = pendingReject.id
                setPendingReject(null)
                onReject(id)
              }}
            >
              Reject request
            </CatalogButton>
          </CatalogDialogFooter>
        </CatalogDialogContent>
      </CatalogDialog>
    </>
  )
}
