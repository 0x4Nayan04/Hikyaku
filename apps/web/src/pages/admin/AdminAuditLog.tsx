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
  const name =
    (entry.metadata?.tenantName as string | undefined) ??
    (entry.metadata?.oldName as string | undefined)
  if (name && entry.tenant_id) return `${name} · ${entry.tenant_id}`
  return name ?? entry.tenant_id ?? (entry.metadata?.tenantId as string | undefined) ?? '—'
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
      description="Review platform administration activity."
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
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Time</DataTableHead>
                <DataTableHead>Action</DataTableHead>
                <DataTableHead>Actor</DataTableHead>
                <DataTableHead>Tenant</DataTableHead>
                <DataTableHead>Details</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {entries.map((entry) => (
                <DataTableRow key={entry.id}>
                  <DataTableCell className="whitespace-nowrap text-muted-strong">
                    {formatDateTime(entry.created_at)}
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs text-ink">
                    {entry.action}
                  </DataTableCell>
                  <DataTableCell
                    className="max-w-44 truncate text-xs text-muted-strong"
                    title={entry.actor_email ?? entry.actor_id ?? undefined}
                  >
                    {entry.actor_email ?? (entry.actor_id ? entry.actor_id.slice(0, 8) : 'System')}
                  </DataTableCell>
                  <DataTableCell
                    className="max-w-56 truncate text-muted-strong"
                    title={tenantText(entry)}
                  >
                    {tenantText(entry)}
                  </DataTableCell>
                  <DataTableCell
                    className="max-w-80 truncate text-muted-strong"
                    title={metadataText(entry.metadata)}
                  >
                    {metadataText(entry.metadata)}
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
