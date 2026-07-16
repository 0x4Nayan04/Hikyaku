import { Check, X } from 'lucide-react'
import type { SignupRequest } from '@/api/types'
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
import { CatalogButton } from '@/components/catalog/CatalogButton'
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
  if (loading && requests.length === 0) {
    return <PageLoading variant="table" />
  }

  return (
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
                        variant="secondary"
                        className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
                        disabled={isActing}
                        onClick={() => onReject(request.id)}
                      >
                        <X className="mr-1 size-3.5" />
                        Reject
                      </CatalogButton>
                      <CatalogButton
                        className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
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
  )
}
