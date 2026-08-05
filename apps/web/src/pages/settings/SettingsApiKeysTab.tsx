import { KeyRound, Plus, RotateCcw } from 'lucide-react'
import type { ApiKey } from '@/api/types'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/console/DataTable'
import { DataPanel } from '@/components/console/DataPanel'
import { DataPanelEmpty } from '@/components/console/DataPanelEmpty'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { PaginationBar } from '@/components/console/PaginationBar'
import { shouldPaginate } from '@/components/console/pagination-utils'
import { StatusBadge } from '@/components/console/StatusBadge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type SettingsApiKeysTabProps = {
  apiKeys: ApiKey[]
  total: number
  offset: number
  pageSize: number
  loadingKeys: boolean
  keysError: string | null
  creatingKey: boolean
  rotatingId: string | null
  revokingId: string | null
  onCreateKey: () => void
  onRotate: (id: string) => void
  onRevokeClick: (apiKey: ApiKey) => void
  onOffsetChange: (offset: number) => void
}

export function SettingsApiKeysTab({
  apiKeys,
  total,
  offset,
  pageSize,
  loadingKeys,
  keysError,
  creatingKey,
  rotatingId,
  revokingId,
  onCreateKey,
  onRotate,
  onRevokeClick,
  onOffsetChange,
}: SettingsApiKeysTabProps) {
  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + apiKeys.length, total)
  const canGoBack = offset > 0
  const canGoForward = offset + pageSize < total

  return (
    <>
      {keysError ? (
        <PageBanner variant="error" title="Could not load API keys" description={keysError} />
      ) : null}

      {loadingKeys && apiKeys.length === 0 ? (
        <PageLoading variant="table" />
      ) : (
        <DataPanel
          title="API keys"
          loading={loadingKeys && apiKeys.length > 0}
          emptyFlush
          actions={
            <Button size="sm" onClick={onCreateKey} disabled={creatingKey}>
              <Plus className="mr-1 size-3.5" aria-hidden="true" />
              {creatingKey ? 'Creating…' : 'Create API key'}
            </Button>
          }
          footer={
            shouldPaginate(total, pageSize) ? (
              <div className="pagination-bar-footer">
                <PaginationBar
                  pageStart={pageStart}
                  pageEnd={pageEnd}
                  total={total}
                  canGoBack={canGoBack}
                  canGoForward={canGoForward}
                  onPrevious={() => onOffsetChange(Math.max(0, offset - pageSize))}
                  onNext={() => onOffsetChange(offset + pageSize)}
                />
              </div>
            ) : undefined
          }
          empty={
            !loadingKeys && apiKeys.length === 0 ? (
              <DataPanelEmpty
                icon={KeyRound}
                title="No API keys yet"
                description="Create a key for Bearer token authentication."
              />
            ) : undefined
          }
        >
          {apiKeys.length > 0 ? (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Prefix</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead className="hidden md:table-cell">Created</DataTableHead>
                  <DataTableHead className="hidden lg:table-cell">Last used</DataTableHead>
                  <DataTableHead className="text-right">Actions</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {apiKeys.map((apiKey) => {
                  const revoked = Boolean(apiKey.revoked_at)

                  return (
                    <DataTableRow
                      key={apiKey.id}
                      className={cn('group/row', revoked && 'settings-table-row--revoked')}
                    >
                      <DataTableCell className="font-mono text-sm">{apiKey.prefix}…</DataTableCell>
                      <DataTableCell>
                        <StatusBadge kind="api-key" revoked={revoked} />
                      </DataTableCell>
                      <DataTableCell className="hidden text-sm text-muted-strong md:table-cell">
                        {formatDateTime(apiKey.created_at)}
                      </DataTableCell>
                      <DataTableCell className="hidden text-sm text-muted-strong lg:table-cell">
                        {apiKey.last_used_at ? formatDateTime(apiKey.last_used_at) : 'Never'}
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        {!revoked ? (
                          <div className="settings-row-actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={rotatingId === apiKey.id}
                              onClick={() => onRotate(apiKey.id)}
                            >
                              <RotateCcw className="mr-1 size-3" aria-hidden="true" />
                              Rotate
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={revokingId === apiKey.id}
                              onClick={() => onRevokeClick(apiKey)}
                            >
                              Revoke
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-strong">—</span>
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  )
                })}
              </DataTableBody>
            </DataTable>
          ) : null}
        </DataPanel>
      )}
    </>
  )
}
