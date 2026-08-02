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

export function TenantAdmin() {
  const { id } = useParams<{ id: string }>()
  const [tenant, setTenant] = useState<AdminTenant | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    if (!id) {
      setError('Tenant ID is missing')
      setLoading(false)
      return
    }

    let cancelled = false
    Promise.all([getAdminTenant(id), listTenantUsers(id, { limit: 100, offset: 0 })])
      .then(([tenantResult, usersResult]) => {
        if (cancelled) return
        setTenant(tenantResult)
        setUsers(usersResult.data)
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

      {loading ? (
        <PageLoading variant="detail-metrics" />
      ) : tenant ? (
        <TenantAdminDetails
          tenant={tenant}
          users={users}
          onUserDeleted={(userId) => setUsers((current) => current.filter((u) => u.id !== userId))}
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
