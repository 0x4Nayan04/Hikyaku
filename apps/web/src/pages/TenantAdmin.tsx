import { useCallback, useEffect, useReducer } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Link2 } from 'lucide-react'
import { ApiError, getAdminTenant, listTenantUsers } from '@/api/client'
import type { AdminTenant, User } from '@/api/types'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { ConsolePage } from '@/components/console/ConsolePage'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import { TenantAdminCreateUserDialog } from '@/pages/tenant-admin/TenantAdminCreateUserDialog'
import { TenantAdminDetails } from '@/pages/tenant-admin/TenantAdminDetails'
import { TenantAdminInviteUserDialog } from '@/pages/tenant-admin/TenantAdminInviteUserDialog'

async function findTenant(tenantId: string): Promise<AdminTenant | null> {
  try {
    return await getAdminTenant(tenantId)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null
    }
    throw err
  }
}

async function fetchExistingUsers(tenantId: string): Promise<User[]> {
  try {
    const result = await listTenantUsers(tenantId, { limit: 100, offset: 0 })
    return result.data
  } catch {
    toast.error('Failed to load existing users')
    return []
  }
}

type TenantAdminPageState = {
  tenant: AdminTenant | null
  createdUsers: User[]
  existingUsers: User[]
  loading: boolean
  error: string | null
  createOpen: boolean
  inviteOpen: boolean
}

type TenantAdminPageAction =
  | { type: 'load_success'; tenant: AdminTenant; existingUsers: User[] }
  | { type: 'load_not_found' }
  | { type: 'load_error'; error: string }
  | { type: 'load_finished' }
  | { type: 'missing_id' }
  | { type: 'set_create_open'; open: boolean }
  | { type: 'set_invite_open'; open: boolean }
  | { type: 'user_created'; user: User }
  | { type: 'user_deleted'; userId: string }

const initialTenantAdminPageState: TenantAdminPageState = {
  tenant: null,
  createdUsers: [],
  existingUsers: [],
  loading: true,
  error: null,
  createOpen: false,
  inviteOpen: false,
}

function tenantAdminPageReducer(
  state: TenantAdminPageState,
  action: TenantAdminPageAction,
): TenantAdminPageState {
  switch (action.type) {
    case 'load_success':
      return { ...state, tenant: action.tenant, existingUsers: action.existingUsers, error: null }
    case 'load_not_found':
      return { ...state, tenant: null, error: 'Tenant not found' }
    case 'load_error':
      return { ...state, error: action.error }
    case 'load_finished':
      return { ...state, loading: false }
    case 'missing_id':
      return { ...state, error: 'Tenant ID is missing', loading: false }
    case 'set_create_open':
      return { ...state, createOpen: action.open }
    case 'set_invite_open':
      return { ...state, inviteOpen: action.open }
    case 'user_created':
      return { ...state, createdUsers: [action.user, ...state.createdUsers] }
    case 'user_deleted':
      return {
        ...state,
        createdUsers: state.createdUsers.filter((user) => user.id !== action.userId),
        existingUsers: state.existingUsers.filter((user) => user.id !== action.userId),
      }
  }
}

export function TenantAdmin() {
  const { id } = useParams<{ id: string }>()
  const [state, dispatch] = useReducer(tenantAdminPageReducer, initialTenantAdminPageState)

  const loadTenant = useCallback(async () => {
    if (!id) {
      dispatch({ type: 'missing_id' })
      return
    }

    const [match, existing] = await Promise.all([findTenant(id), fetchExistingUsers(id)])

    if (!match) {
      dispatch({ type: 'load_not_found' })
      return
    }

    dispatch({ type: 'load_success', tenant: match, existingUsers: existing })
  }, [id])

  useEffect(() => {
    let cancelled = false

    loadTenant()
      .catch((err) => {
        if (!cancelled) {
          dispatch({
            type: 'load_error',
            error: err instanceof ApiError ? err.message : 'Failed to load tenant',
          })
        }
      })
      .finally(() => {
        if (!cancelled) {
          dispatch({ type: 'load_finished' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [loadTenant])

  return (
    <ConsolePage
      marker="Admin · Tenant"
      title={state.tenant?.name ?? 'Loading tenant…'}
      description={
        state.tenant
          ? `Manage users for ${state.tenant.name}. Created ${formatDateTime(state.tenant.created_at)}.`
          : 'Create additional users for this tenant.'
      }
      actions={
        <>
          {state.tenant && id ? (
            <>
              <CatalogButton
                variant="primary"
                className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
                onClick={() => dispatch({ type: 'set_create_open', open: true })}
              >
                Create user
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </CatalogButton>
              <CatalogButton
                variant="secondary"
                className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
                onClick={() => dispatch({ type: 'set_invite_open', open: true })}
              >
                <Link2 className="size-3.5" aria-hidden="true" />
                Invite user
              </CatalogButton>
            </>
          ) : null}
          <CatalogButton
            variant="secondary"
            className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
            asChild
          >
            <Link to="/admin">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to admin
            </Link>
          </CatalogButton>
        </>
      }
    >
      {state.error ? (
        <PageBanner variant="error" title="Could not load tenant" description={state.error} />
      ) : null}

      {state.loading ? (
        <PageLoading variant="detail-metrics" />
      ) : state.tenant ? (
        <TenantAdminDetails
          tenant={state.tenant}
          existingUsers={state.existingUsers}
          createdUsers={state.createdUsers}
          onUserDeleted={(userId) => dispatch({ type: 'user_deleted', userId })}
        />
      ) : null}

      {state.tenant && id ? (
        <>
          <TenantAdminInviteUserDialog
            tenantId={id}
            tenantName={state.tenant.name}
            open={state.inviteOpen}
            onOpenChange={(open) => dispatch({ type: 'set_invite_open', open })}
          />

          <TenantAdminCreateUserDialog
            tenantId={id}
            tenantName={state.tenant.name}
            open={state.createOpen}
            onOpenChange={(open) => dispatch({ type: 'set_create_open', open })}
            onUserCreated={(user) => dispatch({ type: 'user_created', user })}
          />
        </>
      ) : null}
    </ConsolePage>
  )
}
