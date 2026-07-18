import { useCallback, useEffect, useState } from 'react'
import { ApiError, listAuditLog } from '@/api/client'
import type { AuditLogEntry } from '@/api/types'
import {
  CatalogSelect,
  CatalogSelectContent,
  CatalogSelectItem,
  CatalogSelectTrigger,
  CatalogSelectValue,
} from '@/components/catalog/CatalogSelect'
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
import { SettingsCopyAction } from '@/components/console/SettingsCatalog'
import { StatusBadge } from '@/components/console/StatusBadge'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatDateTime } from '@/lib/format'

const PAGE_SIZE = 25
const ALL_ACTIONS = 'all'
const AUDIT_ACTIONS = [
  'tenant.created',
  'tenant.renamed',
  'tenant.deleted',
  'tenant.suspended',
  'tenant.unsuspended',
  'signup.approved',
  'signup.rejected',
  'user.deleted',
  'user.password_reset',
  'operator.invited',
  'operator.removed',
] as const

function metadataText(metadata: AuditLogEntry['metadata']): string {
  if (!metadata || Object.keys(metadata).length === 0) return '—'
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ')
}

function tenantText(entry: AuditLogEntry): string {
  const name = tenantName(entry)
  if (name && entry.tenant_id) return `${name} · ${entry.tenant_id}`
  return name ?? entry.tenant_id ?? (entry.metadata?.tenantId as string | undefined) ?? '—'
}

function tenantName(entry: AuditLogEntry): string | undefined {
  return (
    (entry.metadata?.tenantName as string | undefined) ??
    (entry.metadata?.oldName as string | undefined)
  )
}

function tenantId(entry: AuditLogEntry): string | undefined {
  return entry.tenant_id ?? (entry.metadata?.tenantId as string | undefined)
}

function actionLabel(action: string): string {
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function actionTone(action: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (/(deleted|removed|rejected)$/.test(action)) return 'danger'
  if (action.endsWith('suspended')) return 'warning'
  if (/(created|approved|invited|unsuspended)$/.test(action)) return 'success'
  if (action.endsWith('password_reset')) return 'info'
  return 'neutral'
}

function AuditDetailsCell({ metadata }: { metadata: AuditLogEntry['metadata'] }) {
  const text = metadataText(metadata)
  if (!metadata || Object.keys(metadata).length === 0) {
    return <span className="block truncate">—</span>
  }

  const entries = Object.entries(metadata)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="block w-full min-w-0 cursor-pointer truncate text-left hover:text-foreground catalog-focus"
          aria-label={`Show full details: ${text}`}
        >
          {text}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        collisionPadding={12}
        className="w-80 max-w-[min(20rem,calc(100vw-2rem))] gap-3 border border-border bg-background shadow-none"
      >
        <PopoverHeader className="flex-row items-center justify-between gap-2">
          <PopoverTitle className="font-mono text-xs font-semibold tracking-wider text-muted-strong uppercase">
            Details
          </PopoverTitle>
          <SettingsCopyAction value={text} copyLabel="Details" />
        </PopoverHeader>
        <dl className="grid gap-2.5">
          {entries.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="font-mono text-[11px] text-muted-foreground">{key}</dt>
              <dd className="break-all font-mono text-xs text-foreground">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  )
}

export function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [action, setAction] = useState(ALL_ACTIONS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listAuditLog({
        limit: PAGE_SIZE,
        offset,
        action: action === ALL_ACTIONS ? undefined : action,
      })
      setEntries(result.data)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }, [action, offset])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  return (
    <ConsolePage
      marker="Platform · Admin"
      title="Audit log"
      description="Platform administration actions."
      toolbar={
        <div className="w-full sm:w-64">
          <CatalogSelect
            value={action}
            onValueChange={(value) => {
              setAction(value)
              setOffset(0)
            }}
          >
            <CatalogSelectTrigger aria-label="Filter by action">
              <CatalogSelectValue placeholder="All actions" />
            </CatalogSelectTrigger>
            <CatalogSelectContent>
              <CatalogSelectItem value={ALL_ACTIONS}>All actions</CatalogSelectItem>
              {AUDIT_ACTIONS.map((value) => (
                <CatalogSelectItem key={value} value={value}>
                  {value}
                </CatalogSelectItem>
              ))}
            </CatalogSelectContent>
          </CatalogSelect>
        </div>
      }
    >
      {error ? (
        <PageBanner variant="error" title="Could not load audit log" description={error} />
      ) : null}
      {loading && entries.length === 0 ? (
        <PageLoading variant="table" />
      ) : (
        <DataPanel
          title="Platform activity"
          description={`${total.toLocaleString()} matching events`}
          loading={loading}
          empty={entries.length === 0 ? 'No audit events match this filter.' : undefined}
          footer={
            entries.length > 0 ? (
              <PaginationBar
                pageStart={offset + 1}
                pageEnd={Math.min(offset + entries.length, total)}
                total={total}
                pageSize={PAGE_SIZE}
                canGoBack={offset > 0}
                canGoForward={offset + entries.length < total}
                onPrevious={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
                onNext={() => setOffset((value) => value + PAGE_SIZE)}
              />
            ) : undefined
          }
        >
          <DataTable className="admin-audit-table">
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead className="admin-audit-table__col-time">Time</DataTableHead>
                <DataTableHead className="admin-audit-table__col-action">Action</DataTableHead>
                <DataTableHead className="admin-audit-table__col-actor">Actor</DataTableHead>
                <DataTableHead className="admin-audit-table__col-tenant">Tenant</DataTableHead>
                <DataTableHead className="admin-audit-table__col-details">Details</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {entries.map((entry) => (
                <DataTableRow key={entry.id}>
                  <DataTableCell className="admin-audit-table__col-time whitespace-nowrap text-muted-strong">
                    {formatDateTime(entry.created_at)}
                  </DataTableCell>
                  <DataTableCell className="admin-audit-table__col-action">
                    <StatusBadge
                      kind="label"
                      label={actionLabel(entry.action)}
                      tone={actionTone(entry.action)}
                    />
                  </DataTableCell>
                  <DataTableCell
                    className="admin-audit-table__col-actor text-xs text-muted-strong"
                    title={entry.actor_email ?? entry.actor_id ?? undefined}
                  >
                    <span className="block truncate">
                      {entry.actor_email ?? (entry.actor_id ? entry.actor_id.slice(0, 8) : 'System')}
                    </span>
                  </DataTableCell>
                  <DataTableCell
                    className="admin-audit-table__col-tenant text-muted-strong"
                    title={tenantText(entry)}
                  >
                    {tenantName(entry) ? (
                      <>
                        <span className="block truncate font-medium text-foreground">
                          {tenantName(entry)}
                        </span>
                        {tenantId(entry) ? (
                          <span className="block truncate font-mono text-[11px] text-muted-foreground">
                            {tenantId(entry)}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="block truncate font-mono text-xs">
                        {tenantId(entry) ?? '—'}
                      </span>
                    )}
                  </DataTableCell>
                  <DataTableCell className="admin-audit-table__col-details text-muted-strong">
                    <AuditDetailsCell metadata={entry.metadata} />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataPanel>
      )}
    </ConsolePage>
  )
}
