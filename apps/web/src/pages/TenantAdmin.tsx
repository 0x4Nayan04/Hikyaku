import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Link2 } from 'lucide-react'
import { getAdminTenant, listTenantUsers } from '@/api/client'
import type { AdminTenant, User } from '@/api/types'
import { Button } from '@/components/ui/button'
import { ConsolePage } from '@/components/console/ConsolePage'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { PAGE_SIZE } from '@/components/console/pagination-utils'
import { InviteUrlDialog } from '@/components/invites/InviteUrlDialog'
import { useDetailFetch } from '@/hooks/useDetailFetch'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { formatDateTime } from '@/lib/format'
import { TenantAdminDetails } from '@/pages/tenant-admin/TenantAdminDetails'
import { TenantAdminInviteUserDialog } from '@/pages/tenant-admin/TenantAdminInviteUserDialog'

export default function TenantAdmin() {
  const { id } = useParams<{ id: string }>()
  const { data: tenant, loading, error } = useDetailFetch<AdminTenant>({
    id,
    fetchDetail: getAdminTenant,
    missingError: 'Tenant ID is missing',
    fallbackError: 'Failed to load tenant',
  })
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteResult, setInviteResult] = useState<{
    inviteUrl: string
    expiresAt: string
  } | null>(null)
  const {
    data: users,
    isEmpty,
    hasMore: usersHasMore,
    offset: userOffset,
    setOffset: setUserOffset,
    isInitial: loadingUsers,
    isRefreshing: refreshingUsers,
    error: usersError,
    reload: reloadUsers,
  } = usePaginatedList<User>({
    pageSize: PAGE_SIZE,
    fetchPage: ({ limit, offset, signal }) =>
      id
        ? listTenantUsers(id, { limit, offset }, { signal })
        : Promise.resolve({ data: [], has_more: false, limit, offset: 0 }),
    fallbackError: 'Failed to load tenant users',
    queryKey: id,
  })

  return (
    <ConsolePage
      marker="Admin · Tenant"
      title={tenant?.name ?? 'Tenant'}
      description={
        tenant
          ? `Manage users for ${tenant.name}. Created ${formatDateTime(tenant.created_at)}.`
          : 'Manage tenant users.'
      }
      actions={
        <>
          {tenant && id ? (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <Link2 className="size-3.5" aria-hidden="true" />
              Invite user
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" asChild>
            <Link to="/admin">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to admin
            </Link>
          </Button>
        </>
      }
    >
      {error ? (
        <PageBanner variant="error" title="Could not load tenant" description={error} />
      ) : null}
      {usersError ? (
        <PageBanner variant="error" title="Could not load tenant users" description={usersError} />
      ) : null}

      {loading || loadingUsers ? (
        <PageLoading variant="detail-metrics" />
      ) : tenant ? (
        <TenantAdminDetails
          tenant={tenant}
          users={users}
          isEmpty={isEmpty}
          hasMore={usersHasMore}
          offset={userOffset}
          pageSize={PAGE_SIZE}
          loading={refreshingUsers}
          onOffsetChange={setUserOffset}
          onUserDeleted={() => void reloadUsers()}
        />
      ) : null}

      {tenant && id ? (
        <TenantAdminInviteUserDialog
          tenantId={id}
          tenantName={tenant.name}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          onInvited={setInviteResult}
        />
      ) : null}

      <InviteUrlDialog
        open={inviteResult !== null}
        inviteUrl={inviteResult?.inviteUrl ?? null}
        expiresAt={inviteResult?.expiresAt ?? null}
        onOpenChange={(open) => {
          if (!open) setInviteResult(null)
        }}
      />
    </ConsolePage>
  )
}
