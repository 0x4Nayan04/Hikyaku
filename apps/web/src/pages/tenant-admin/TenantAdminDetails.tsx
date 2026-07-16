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

type TenantAdminDetailsProps = {
  tenant: AdminTenant
  existingUsers: User[]
  createdUsers: User[]
}

export function TenantAdminDetails({ tenant, existingUsers, createdUsers }: TenantAdminDetailsProps) {
  // Merge existing API users with session-created users (deduped by id)
  const existingIds = new Set(existingUsers.map((u) => u.id))
  const sessionOnly = createdUsers.filter((u) => !existingIds.has(u.id))
  const allUsers = [...sessionOnly, ...existingUsers]

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
        title={`Users (${allUsers.length})`}
        empty={
          allUsers.length === 0 &&
          'No users found for this tenant. Create a user or send an invite to get started.'
        }
      >
        {allUsers.length > 0 && (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Name</DataTableHead>
                <DataTableHead>Email</DataTableHead>
                <DataTableHead className="hidden md:table-cell">User ID</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {allUsers.map((user) => (
                <DataTableRow key={user.id}>
                  <DataTableCell className="font-medium text-ink">{user.name}</DataTableCell>
                  <DataTableCell className="text-sm text-muted-strong">
                    {user.email}
                  </DataTableCell>
                  <DataTableCell
                    className="hidden max-w-48 truncate font-mono text-xs text-muted-strong md:table-cell"
                    title={user.id}
                  >
                    {user.id}
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
