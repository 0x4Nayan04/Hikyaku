import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import {
  ApiError,
  approveAdminSignupRequest,
  listAdminSignupRequests,
  listAdminTenants,
  listAuditLog,
  rejectAdminSignupRequest,
} from '@/api/client'
import type { AdminTenant, AuditLogEntry, SignupRequest, User } from '@/api/types'
import { DataPanel } from '@/components/console/DataPanel'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { StatusBadge } from '@/components/console/StatusBadge'
import { InviteUrlDialog } from '@/components/invites/InviteUrlDialog'
import { ConsolePage } from '@/components/console/ConsolePage'
import { AdminCreateTenantDialog } from '@/pages/admin/AdminCreateTenantDialog'
import { AdminInviteTenantDialog } from '@/pages/admin/AdminInviteTenantDialog'
import { AdminSignupRequestsTable } from '@/pages/admin/AdminSignupRequestsTable'
import { AdminTenantTable } from '@/pages/admin/AdminTenantTable'
import { CatalogInput } from '@/components/catalog/CatalogInput'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import { formatDateTime } from '@/lib/format'

const PAGE_SIZE = 25

type AdminPageState = {
  tenants: AdminTenant[]
  total: number
  offset: number
  loading: boolean
  error: string | null
  signupRequests: SignupRequest[]
  signupLoading: boolean
  signupError: string | null
  signupActingId: string | null
  approvedResult: { tenant: AdminTenant; user: User } | null
  createOpen: boolean
  inviteOpen: boolean
  createdResult: { tenant: AdminTenant; user: User } | null
  inviteUrl: string | null
  inviteExpiresAt: string | null
  auditEntries: AuditLogEntry[]
  auditLoading: boolean
  version: number
}

type AdminPageAction =
  | { type: 'load_success'; tenants: AdminTenant[]; total: number; offset: number }
  | { type: 'load_error'; error: string }
  | { type: 'load_finished' }
  | { type: 'set_offset'; offset: number }
  | { type: 'signup_load_success'; requests: SignupRequest[] }
  | { type: 'signup_load_error'; error: string }
  | { type: 'signup_load_finished' }
  | { type: 'signup_acting'; id: string | null }
  | { type: 'signup_approved'; id: string; result: { tenant: AdminTenant; user: User } }
  | { type: 'signup_rejected'; id: string }
  | { type: 'set_create_open'; open: boolean }
  | { type: 'set_invite_open'; open: boolean }
  | { type: 'tenant_created'; result: { tenant: AdminTenant; user: User } }
  | { type: 'invite_created'; inviteUrl: string; expiresAt: string }
  | { type: 'clear_invite_url' }
  | { type: 'audit_load_success'; entries: AuditLogEntry[] }
  | { type: 'audit_load_error' }
  | { type: 'force_refresh' }

const initialAdminPageState: AdminPageState = {
  tenants: [],
  total: 0,
  offset: 0,
  loading: true,
  error: null,
  signupRequests: [],
  signupLoading: true,
  signupError: null,
  signupActingId: null,
  approvedResult: null,
  createOpen: false,
  inviteOpen: false,
  createdResult: null,
  inviteUrl: null,
  inviteExpiresAt: null,
  auditEntries: [],
  auditLoading: true,
  version: 0,
}

function adminPageReducer(state: AdminPageState, action: AdminPageAction): AdminPageState {
  switch (action.type) {
    case 'load_success':
      // Ignore stale responses from previous page fetches (race condition guard)
      if (action.offset < state.offset) {
        return state
      }
      return {
        ...state,
        tenants: action.tenants,
        total: action.total,
        offset: action.offset,
        error: null,
      }
    case 'load_error':
      return { ...state, error: action.error }
    case 'load_finished':
      return { ...state, loading: false }
    case 'set_offset':
      return { ...state, offset: action.offset, loading: true }
    case 'signup_load_success':
      return { ...state, signupRequests: action.requests, signupError: null }
    case 'signup_load_error':
      return { ...state, signupError: action.error }
    case 'signup_load_finished':
      return { ...state, signupLoading: false }
    case 'signup_acting':
      return { ...state, signupActingId: action.id }
    case 'signup_approved':
      return {
        ...state,
        signupRequests: state.signupRequests.filter((request) => request.id !== action.id),
        approvedResult: action.result,
        signupActingId: null,
        offset: 0,
        loading: true,
      }
    case 'signup_rejected':
      return {
        ...state,
        signupRequests: state.signupRequests.filter((request) => request.id !== action.id),
        signupActingId: null,
      }
    case 'set_create_open':
      return { ...state, createOpen: action.open }
    case 'set_invite_open':
      return { ...state, inviteOpen: action.open }
    case 'tenant_created':
      return { ...state, createdResult: action.result, offset: 0, loading: true }
    case 'invite_created':
      return { ...state, inviteUrl: action.inviteUrl, inviteExpiresAt: action.expiresAt }
    case 'clear_invite_url':
      return { ...state, inviteUrl: null, inviteExpiresAt: null }
    case 'audit_load_success':
      return { ...state, auditEntries: action.entries, auditLoading: false }
    case 'audit_load_error':
      return { ...state, auditLoading: false }
    case 'force_refresh':
      return { ...state, version: state.version + 1, loading: true }
  }
}

type ActivityItem = {
  id: string
  type: 'approved' | 'created' | 'signup' | 'deleted' | 'renamed' | 'suspended' | 'unsuspended'
  entity: string
  action: string
  time: string
}

export function Admin() {
  const [state, dispatch] = useReducer(adminPageReducer, initialAdminPageState)
  const [searchQuery, setSearchQuery] = useState('')

  const loadTenants = useCallback(async (nextOffset: number, search?: string) => {
    const params: Parameters<typeof listAdminTenants>[0] = { limit: PAGE_SIZE, offset: nextOffset }
    if (search?.trim()) {
      params.search = search.trim()
    }
    const result = await listAdminTenants(params)
    // Only apply if this fetch is for the current requested offset
    dispatch({
      type: 'load_success',
      tenants: result.data,
      total: result.total,
      offset: nextOffset,
    })
  }, [])

  const loadSignupRequests = useCallback(async () => {
    const result = await listAdminSignupRequests({ status: 'pending', limit: 50, offset: 0 })
    dispatch({ type: 'signup_load_success', requests: result.data })
  }, [])

  const loadAuditEntries = useCallback(async () => {
    try {
      const result = await listAuditLog({ limit: 10 })
      dispatch({ type: 'audit_load_success', entries: result.data })
    } catch {
      dispatch({ type: 'audit_load_error' })
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    loadTenants(state.offset, searchQuery)
      .catch((err) => {
        if (!cancelled) {
          dispatch({
            type: 'load_error',
            error: err instanceof ApiError ? err.message : 'Failed to load tenants',
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
  }, [loadTenants, state.offset, state.version, searchQuery])

  useEffect(() => {
    let cancelled = false

    loadSignupRequests()
      .catch((err) => {
        if (!cancelled) {
          dispatch({
            type: 'signup_load_error',
            error: err instanceof ApiError ? err.message : 'Failed to load signup requests',
          })
        }
      })
      .finally(() => {
        if (!cancelled) {
          dispatch({ type: 'signup_load_finished' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [loadSignupRequests])

  async function handleApproveSignupRequest(id: string) {
    dispatch({ type: 'signup_acting', id })

    try {
      const result = await approveAdminSignupRequest(id)
      dispatch({ type: 'signup_approved', id, result })
      await Promise.all([loadTenants(0, searchQuery), loadSignupRequests(), loadAuditEntries()])
    } catch (err) {
      dispatch({
        type: 'signup_load_error',
        error: err instanceof ApiError ? err.message : 'Failed to approve signup request',
      })
      dispatch({ type: 'signup_acting', id: null })
    }
  }

  async function handleRejectSignupRequest(id: string) {
    dispatch({ type: 'signup_acting', id })

    try {
      await rejectAdminSignupRequest(id)
      dispatch({ type: 'signup_rejected', id })
      await loadAuditEntries()
    } catch (err) {
      dispatch({
        type: 'signup_load_error',
        error: err instanceof ApiError ? err.message : 'Failed to reject signup request',
      })
      dispatch({ type: 'signup_acting', id: null })
    }
  }

  const pendingCount = state.signupRequests.length

  useEffect(() => {
    void loadAuditEntries()
  }, [loadAuditEntries])

  const activityItems = useMemo((): ActivityItem[] => {
    const items: ActivityItem[] = []

    function auditEntity(entry: AuditLogEntry): string {
      const meta: Record<string, unknown> = entry.metadata ?? {}
      switch (entry.action) {
        case 'tenant.created':
        case 'tenant.deleted':
        case 'tenant.suspended':
        case 'tenant.unsuspended':
          return (meta.tenantName as string | undefined) ?? 'Tenant'
        case 'tenant.renamed':
          return (meta.oldName as string | undefined) ?? 'Tenant'
        case 'signup.approved':
        case 'signup.rejected':
        case 'operator.invited':
        case 'operator.removed':
          return (meta.email as string | undefined) ?? 'Admin'
        default:
          return entry.action
      }
    }

    function auditAction(entry: AuditLogEntry): string {
      const meta: Record<string, unknown> = entry.metadata ?? {}
      switch (entry.action) {
        case 'tenant.created':
          return 'Provisioned'
        case 'tenant.deleted':
          return 'Deleted'
        case 'tenant.renamed':
          return `Renamed → ${(meta.newName as string | undefined) ?? ''}`
        case 'tenant.suspended':
          return 'Suspended'
        case 'tenant.unsuspended':
          return 'Reactivated'
        case 'signup.approved':
          return 'Approved'
        case 'signup.rejected':
          return 'Rejected'
        case 'operator.invited':
          return 'Admin invited'
        case 'operator.removed':
          return 'Admin removed'
        default:
          return entry.action
      }
    }

    function auditType(entry: AuditLogEntry): ActivityItem['type'] {
      switch (entry.action) {
        case 'tenant.created':
        case 'operator.invited':
          return 'created'
        case 'tenant.deleted':
        case 'operator.removed':
          return 'deleted'
        case 'tenant.renamed':
          return 'renamed'
        case 'tenant.suspended':
          return 'suspended'
        case 'tenant.unsuspended':
          return 'unsuspended'
        case 'signup.approved':
          return 'approved'
        case 'signup.rejected':
          return 'signup'
        default:
          return 'signup'
      }
    }

    for (const entry of state.auditEntries) {
      items.push({
        id: `audit-${entry.id}`,
        type: auditType(entry),
        entity: auditEntity(entry),
        action: auditAction(entry),
        time: formatDateTime(entry.created_at),
      })
    }

    return items.slice(0, 10)
  }, [state.auditEntries])

  const activityToneClass: Record<ActivityItem['type'], string> = {
    approved: 'text-status-success',
    created: 'text-status-info',
    signup: 'text-status-warning',
    deleted: 'text-status-danger',
    renamed: 'text-status-info',
    suspended: 'text-status-warning',
    unsuspended: 'text-status-success',
  }

  const activityBadgeTone: Record<ActivityItem['type'], 'success' | 'info' | 'warning' | 'danger'> =
    {
      approved: 'success',
      created: 'info',
      signup: 'warning',
      deleted: 'danger',
      renamed: 'info',
      suspended: 'warning',
      unsuspended: 'success',
    }

  return (
    <ConsolePage
      marker="Platform · Admin"
      title="Tenant management"
      description="Platform ops only: approve signups, create tenants, and invite owners. Manage platform admins under Admins. Super-admins do not send events or run tenant deliveries — use a tenant owner account for that."
      actions={
        <>
          <CatalogButton
            size="sm"
            variant="secondary"
            onClick={() => dispatch({ type: 'set_invite_open', open: true })}
          >
            <Link2 className="size-4" strokeWidth={1.75} />
            Invite
          </CatalogButton>
          <CatalogButton
            size="sm"
            onClick={() => dispatch({ type: 'set_create_open', open: true })}
          >
            <Plus className="size-4" strokeWidth={1.75} />
            Create tenant
          </CatalogButton>
        </>
      }
      toolbar={
        <div className="relative w-full">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-strong"
            aria-hidden="true"
          />
          <CatalogInput
            placeholder="Search tenants by name or ID…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              dispatch({ type: 'set_offset', offset: 0 })
            }}
            className="min-h-0 w-full pl-9"
          />
        </div>
      }
    >
      {state.error ? (
        <PageBanner variant="error" title="Could not load tenants" description={state.error} />
      ) : null}

      {state.signupError ? (
        <PageBanner
          variant="error"
          title="Signup request failed"
          description={state.signupError}
        />
      ) : null}

      {state.createdResult ? (
        <PageBanner
          variant="success"
          title="Tenant provisioned"
          description={`${state.createdResult.tenant.name} is ready. Owner ${state.createdResult.user.email} can sign in with the password you set.`}
        />
      ) : null}

      {state.approvedResult ? (
        <PageBanner
          variant="success"
          title="Signup request approved"
          description={`${state.approvedResult.tenant.name} is ready. Owner ${state.approvedResult.user.email} can sign in with the password they chose.`}
        />
      ) : null}

      <div className="dashboard-page">
        <AdminPlatformMetrics
          total={state.total}
          pendingCount={pendingCount}
          loading={state.loading}
          signupLoading={state.signupLoading}
        />

        <AdminSignupRequestsTable
          requests={state.signupRequests}
          loading={state.signupLoading}
          actingId={state.signupActingId}
          onApprove={handleApproveSignupRequest}
          onReject={handleRejectSignupRequest}
        />

        <AdminTenantTable
          tenants={state.tenants}
          total={state.total}
          offset={state.offset}
          loading={state.loading}
          onOffsetChange={(offset) => dispatch({ type: 'set_offset', offset })}
          onRefresh={() => {
            dispatch({ type: 'force_refresh' })
            void loadAuditEntries()
          }}
          searchQuery={searchQuery}
        />

        <AdminRecentActivity
          items={activityItems}
          loading={state.auditLoading}
          badgeTone={activityBadgeTone}
          timeToneClass={activityToneClass}
        />
      </div>

      <InviteUrlDialog
        open={state.inviteUrl !== null}
        inviteUrl={state.inviteUrl}
        expiresAt={state.inviteExpiresAt}
        onOpenChange={(open) => {
          if (!open) {
            dispatch({ type: 'clear_invite_url' })
          }
        }}
      />

      <AdminInviteTenantDialog
        open={state.inviteOpen}
        onOpenChange={(open) => dispatch({ type: 'set_invite_open', open })}
        onInvited={({ inviteUrl, expiresAt }) =>
          dispatch({ type: 'invite_created', inviteUrl, expiresAt })
        }
      />

      <AdminCreateTenantDialog
        open={state.createOpen}
        onOpenChange={(open) => dispatch({ type: 'set_create_open', open })}
        onCreated={(result) => {
          dispatch({ type: 'tenant_created', result })
          void Promise.all([loadTenants(0, searchQuery), loadAuditEntries()])
        }}
      />
    </ConsolePage>
  )
}

type MetricTone = 'info' | 'warning'

const metricIconClass: Record<MetricTone, string> = {
  info: 'dashboard-activity-row__icon--event',
  warning: 'dashboard-activity-row__icon--warning',
}

type AdminPlatformMetricsProps = {
  total: number
  pendingCount: number
  loading: boolean
  signupLoading: boolean
}

function AdminPlatformMetrics({
  total,
  pendingCount,
  loading,
  signupLoading,
}: AdminPlatformMetricsProps) {
  const metrics: {
    label: string
    hint: string
    value: string
    icon: LucideIcon
    tone: MetricTone
    primary?: boolean
  }[] = [
    {
      label: 'Total tenants',
      hint: 'Provisioned workspaces',
      value: loading && total === 0 ? '—' : total.toLocaleString(),
      icon: Building2,
      tone: 'info',
      primary: true,
    },
    {
      label: 'Pending signups',
      hint: 'Awaiting your review',
      value: signupLoading && pendingCount === 0 ? '—' : pendingCount.toLocaleString(),
      icon: UserPlus,
      tone: 'warning',
    },
  ]

  return (
    <DataPanel title="Platform overview" description="Tenant and signup counts at a glance">
      <div className="dashboard-activity-list">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className="dashboard-metric-row">
              <span
                className={`dashboard-activity-row__icon ${metricIconClass[metric.tone]}`}
                aria-hidden="true"
              >
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <div className="dashboard-activity-row__main">
                <p className="dashboard-activity-row__name">{metric.label}</p>
                <p className="dashboard-panel-row__hint">{metric.hint}</p>
              </div>
              <span
                className={
                  metric.primary
                    ? 'dashboard-stat-value dashboard-stat-value--primary'
                    : 'dashboard-stat-value'
                }
              >
                {metric.value}
              </span>
            </div>
          )
        })}
      </div>
    </DataPanel>
  )
}

const activityIconClass: Record<ActivityItem['type'], string> = {
  approved: 'dashboard-activity-row__icon--success',
  created: 'dashboard-activity-row__icon--event',
  signup: 'dashboard-activity-row__icon--warning',
  deleted: 'dashboard-activity-row__icon--danger',
  renamed: 'dashboard-activity-row__icon--event',
  suspended: 'dashboard-activity-row__icon--warning',
  unsuspended: 'dashboard-activity-row__icon--success',
}

const activityIcons: Record<ActivityItem['type'], LucideIcon> = {
  approved: CheckCircle2,
  created: Plus,
  signup: ClipboardList,
  deleted: Trash2,
  renamed: Pencil,
  suspended: AlertTriangle,
  unsuspended: CheckCircle2,
}

type AdminRecentActivityProps = {
  items: ActivityItem[]
  loading: boolean
  badgeTone: Record<ActivityItem['type'], 'success' | 'info' | 'warning' | 'danger'>
  timeToneClass: Record<ActivityItem['type'], string>
}

function AdminRecentActivity({
  items,
  loading,
  badgeTone,
  timeToneClass,
}: AdminRecentActivityProps) {
  if (loading && items.length === 0) {
    return <PageLoading variant="table" />
  }

  return (
    <DataPanel
      title="Recent activity"
      description="Latest provisioning and signup actions"
      actions={
        <Link className="text-xs font-medium text-primary hover:underline" to="/admin/audit">
          View all
        </Link>
      }
      empty={
        items.length === 0 ? (
          <div className="dashboard-activity-empty">
            <span className="dashboard-activity-empty__icon" aria-hidden="true">
              <ClipboardList className="size-5" strokeWidth={1.75} />
            </span>
            <p>
              No recent provisioning activity. Approve a signup or create a tenant to populate this
              feed.
            </p>
          </div>
        ) : undefined
      }
      emptyFlush
    >
      {items.length > 0 ? (
        <div className="dashboard-activity-list">
          {items.map((item) => {
            const Icon = activityIcons[item.type]
            return (
              <div key={item.id} className="dashboard-metric-row">
                <span
                  className={`dashboard-activity-row__icon ${activityIconClass[item.type]}`}
                  aria-hidden="true"
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <div className="dashboard-activity-row__main">
                  <p className="dashboard-activity-row__name">{item.entity}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge kind="label" label={item.action} tone={badgeTone[item.type]} />
                  <span className={`text-xs ${timeToneClass[item.type]}`}>{item.time}</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </DataPanel>
  )
}
