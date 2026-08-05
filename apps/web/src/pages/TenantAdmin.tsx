import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Link2 } from 'lucide-react'
import { ApiError, getAdminTenant, listTenantUsers } from '@/api/client'
import type { AdminTenant, User } from '@/api/types'
import { Button } from '@/components/ui/button'
import { ConsolePage } from '@/components/console/ConsolePage'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { formatDateTime } from '@/lib/format'
import { TenantAdminDetails } from '@/pages/tenant-admin/TenantAdminDetails'
import { TenantAdminInviteUserDialog } from '@/pages/tenant-admin/TenantAdminInviteUserDialog'
import { usePaginatedList } from '@/hooks/usePaginatedList'

const USER_PAGE_SIZE = 25

export function TenantAdmin() {
  const { id } = useParams<{ id: string }>()
  const [tenant, setTenant] = useState<AdminTenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const {
    data: users,
    total: userTotal,
    offset: userOffset,
    setOffset: setUserOffset,
    isInitial: loadingUsers,
    isRefreshing: refreshingUsers,
    error: usersError,
    reload: reloadUsers,
  } = usePaginatedList<User>({
    pageSize: USER_PAGE_SIZE,
    fetchPage: ({ limit, offset, signal }) =>
      id
        ? listTenantUsers(id, { limit, offset }, { signal })
        : Promise.resolve({ data: [], total: 0, limit, offset: 0 }),
    fallbackError: 'Failed to load tenant users',
    queryKey: id,
  })

  useEffect(() => {
    if (!id) {
      setError('Tenant ID is missing')
      setLoading(false)
      return
    }

    let cancelled = false
    getAdminTenant(id)
      .then((tenantResult) => {
        if (cancelled) return
        setTenant(tenantResult)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Failed to load tenant')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

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
          total={userTotal}
          offset={userOffset}
          pageSize={USER_PAGE_SIZE}
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
        />
      ) : null}
    </ConsolePage>
  )
}
