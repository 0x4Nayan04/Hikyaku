import { Link } from 'react-router-dom'
import { Copy, KeyRound, Trash2 } from 'lucide-react'
import type { Endpoint } from '@/api/types'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/console/DataTable'
import { DataPanel } from '@/components/console/DataPanel'
import { PageLoading } from '@/components/console/PageLoading'
import { DataPanelEmpty } from '@/components/console/DataPanelEmpty'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import { toast } from '@/lib/toast'
import type { VaultEntry } from './state'

async function copySecret(value: string, label: string) {
  await navigator.clipboard.writeText(value)
  toast.success(`${label} copied`)
}

type SettingsVaultTabProps = {
  vaultEntries: VaultEntry[]
  endpoints: Endpoint[]
  loadingVault: boolean
  onRemoveVaultEntry: (endpointId: string) => void
}

export function SettingsVaultTab({
  vaultEntries,
  endpoints,
  loadingVault,
  onRemoveVaultEntry,
}: SettingsVaultTabProps) {
  const missingCount = endpoints.length - vaultEntries.length
  const isEmpty = !loadingVault && vaultEntries.length === 0

  return (
    <>
      {loadingVault && vaultEntries.length === 0 ? (
        <PageLoading variant="table" />
      ) : (
        <DataPanel
          title="Saved secrets"
          description={
            isEmpty
              ? undefined
              : 'The server cannot recover endpoint signing secrets. Entries here are kept in memory for this browser session only.'
          }
          loading={loadingVault && vaultEntries.length > 0}
          emptyFlush
          footer={
            missingCount > 0 ? (
              <p className="settings-panel-footnote">
                {missingCount} endpoint(s) have no secret saved in this browser.
              </p>
            ) : undefined
          }
          empty={
            isEmpty ? (
              <DataPanelEmpty
                icon={KeyRound}
                title="No secrets saved"
                description={
                  <>
                    Signing secrets are kept in memory for this browser session only — the server cannot
                    recover them. Save a secret when you{' '}
                    <Link to="/endpoints" className="font-medium text-primary hover:underline">
                      create an endpoint
                    </Link>{' '}
                    to see it here.
                  </>
                }
              />
            ) : undefined
          }
        >
          {vaultEntries.length > 0 ? (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Endpoint</DataTableHead>
                  <DataTableHead>Secret</DataTableHead>
                  <DataTableHead className="text-right">Actions</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {vaultEntries.map((entry) => (
                  <DataTableRow key={entry.endpointId} className="group/row">
                    <DataTableCell>
                      <div className="flex flex-col gap-1">
                        <span className="max-w-md truncate text-sm text-foreground">
                          {entry.url ?? 'Unknown endpoint'}
                        </span>
                        <span className="font-mono text-xs text-muted-strong">
                          {entry.endpointId}
                        </span>
                      </div>
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs text-muted-strong">
                      {entry.secret.slice(0, 12)}…
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <div className="settings-row-actions">
                        <CatalogButton
                          variant="ghost"
                          className="h-7 min-h-0 px-2 text-xs"
                          onClick={() => copySecret(entry.secret, 'Secret')}
                        >
                          <Copy className="mr-1 size-3" aria-hidden="true" />
                          Copy
                        </CatalogButton>
                        <CatalogButton
                          variant="ghost"
                          className="h-7 min-h-0 px-2 text-xs"
                          onClick={() => onRemoveVaultEntry(entry.endpointId)}
                        >
                          <Trash2 className="mr-1 size-3" aria-hidden="true" />
                          Remove
                        </CatalogButton>
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          ) : null}
        </DataPanel>
      )}
    </>
  )
}
