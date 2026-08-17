import type { AdminTenant, User } from '@/api/types'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/console/DataTable'
import { DataPanel } from '@/components/console/DataPanel'
import { FormPanel } from '@/components/console/FormPanel'
import { PaginationBar } from '@/components/console/PaginationBar'
import { pageRange, shouldPaginate } from '@/components/console/pagination-utils'
import { TenantAdminUserActions } from '@/pages/tenant-admin/TenantAdminUserActions'
import { useSession } from '@/providers/session-context'

type TenantAdminDetailsProps = {
  tenant: AdminTenant
  users: User[]
  hasMore: boolean
  offset: number
  pageSize: number
  loading: boolean
  onOffsetChange: (offset: number) => void
  onUserDeleted: (userId: string) => void
}

export function TenantAdminDetails({
  tenant,
  users,
  hasMore,
  offset,
  pageSize,
  loading,
  onOffsetChange,
  onUserDeleted,
}: TenantAdminDetailsProps) {
  const { session } = useSession()
  const { pageStart, pageEnd } = pageRange(offset, users.length)
  const isSoleUser = offset === 0 && !hasMore && users.length <= 1
  return (
    <div className="flex flex-col gap-8">
      <FormPanel title="Tenant details">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-muted-strong">Tenant name</dt>
            <dd className="mt-1 text-base font-medium text-ink">{tenant.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-strong">Tenant ID</dt>
            <dd className="mt-1 break-all font-mono text-xs text-ink">{tenant.id}</dd>
          </div>
        </dl>
      </FormPanel>

      <DataPanel
        title="Users"
        loading={loading}
        footer={
          shouldPaginate(hasMore, offset) ? (
            <div className="pagination-bar-footer">
              <PaginationBar
                pageStart={pageStart}
                pageEnd={pageEnd}
                canGoBack={offset > 0}
                canGoForward={hasMore}
                onPrevious={() => onOffsetChange(Math.max(0, offset - pageSize))}
                onNext={() => onOffsetChange(offset + pageSize)}
              />
            </div>
          ) : undefined
        }
        empty={
          users.length === 0 && 'No users found for this tenant. Send an invite to get started.'
        }
      >
        {users.length > 0 && (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Name</DataTableHead>
                <DataTableHead>Email</DataTableHead>
                <DataTableHead className="hidden md:table-cell">User ID</DataTableHead>
                <DataTableHead className="text-right">Actions</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {users.map((user) => (
                <DataTableRow key={user.id}>
                  <DataTableCell className="font-medium text-ink">{user.name}</DataTableCell>
                  <DataTableCell className="text-sm text-muted-strong">{user.email}</DataTableCell>
                  <DataTableCell
                    className="hidden max-w-48 truncate font-mono text-xs text-muted-strong md:table-cell"
                    title={user.id}
                  >
                    {user.id}
                  </DataTableCell>
                  <DataTableCell>
                    <TenantAdminUserActions
                      tenantId={tenant.id}
                      user={user}
                      isSoleUser={isSoleUser}
                      currentUserId={session?.user.id}
                      onDeleted={onUserDeleted}
                    />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </DataPanel>
    </div>
  )
}
