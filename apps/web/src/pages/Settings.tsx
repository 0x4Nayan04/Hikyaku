import { useOutletContext, useSearchParams } from 'react-router-dom'
import { ConsolePage } from '@/components/console/ConsolePage'
import { SettingsLayout } from '@/components/console/SettingsLayout'
import {
  CatalogTabs,
  CatalogTabsContent,
  CatalogTabsList,
  CatalogTabsTrigger,
} from '@/components/catalog/CatalogTabs'
import type { AppOutletContext } from '@/layouts/app-context'
import { SettingsApiKeyDialogs } from '@/pages/settings/SettingsApiKeyDialogs'
import { SettingsApiKeysTab } from '@/pages/settings/SettingsApiKeysTab'
import { SettingsTenantTab } from '@/pages/settings/SettingsTenantTab'
import { SettingsVaultTab } from '@/pages/settings/SettingsVaultTab'
import { SettingsProfileTab } from '@/pages/settings/SettingsProfileTab'
import { useSettingsPage } from '@/pages/settings/useSettingsPage'

export function Settings() {
  const { session } = useOutletContext<AppOutletContext>()
  const isSuperAdmin = session?.user.is_super_admin ?? false

  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'profile'
  const setTab = (newTab: string) => setSearchParams({ tab: newTab }, { replace: true })

  const {
    apiKeysState,
    vaultState,
    dialogState,
    dispatchDialog,
    handleCreateKey,
    handleRevoke,
    handleRotate,
    handleRemoveVaultEntry,
  } = useSettingsPage(isSuperAdmin)

  return (
    <ConsolePage
      marker="Workspace"
      title="Settings"
      description={
        isSuperAdmin
          ? 'Account password and platform admin access.'
          : 'Profile, API keys, endpoint secrets, and tenant identity.'
      }
    >
      <CatalogTabs value={tab} onValueChange={setTab}>
        <CatalogTabsList>
          <CatalogTabsTrigger value="profile">Profile</CatalogTabsTrigger>
          {!isSuperAdmin && (
            <>
              <CatalogTabsTrigger value="tenant">Tenant</CatalogTabsTrigger>
              <CatalogTabsTrigger value="api-keys">API keys</CatalogTabsTrigger>
              <CatalogTabsTrigger value="vault">Endpoint secrets</CatalogTabsTrigger>
            </>
          )}
        </CatalogTabsList>

        <CatalogTabsContent value="profile">
          <SettingsProfileTab />
        </CatalogTabsContent>

        {!isSuperAdmin && (
          <>
            <CatalogTabsContent value="tenant">
              <SettingsLayout>
                <SettingsTenantTab />
              </SettingsLayout>
            </CatalogTabsContent>

            <CatalogTabsContent value="api-keys">
              <SettingsLayout>
                <SettingsApiKeysTab
                apiKeys={apiKeysState.apiKeys}
                loadingKeys={apiKeysState.loading}
                keysError={apiKeysState.error}
                creatingKey={dialogState.creatingKey}
                rotatingId={dialogState.rotatingId}
                revokingId={dialogState.revokingId}
                onCreateKey={handleCreateKey}
                onRotate={handleRotate}
                onRevokeClick={(apiKey) =>
                  dispatchDialog({ type: 'set_revoke_target', target: apiKey })
                }
              />
              </SettingsLayout>
            </CatalogTabsContent>

            <CatalogTabsContent value="vault">
              <SettingsLayout>
                <SettingsVaultTab
                vaultEntries={vaultState.entries}
                endpoints={vaultState.endpoints}
                loadingVault={vaultState.loading}
                onRemoveVaultEntry={handleRemoveVaultEntry}
              />
              </SettingsLayout>
            </CatalogTabsContent>
          </>
        )}
      </CatalogTabs>

      {!isSuperAdmin && (
        <SettingsApiKeyDialogs
          secretKey={dialogState.secretKey}
          revokeTarget={dialogState.revokeTarget}
          revokingId={dialogState.revokingId}
          onSecretKeyChange={(secretKey) =>
            dispatchDialog({ type: 'set_secret_key', secretKey })
          }
          onRevokeTargetChange={(target) =>
            dispatchDialog({ type: 'set_revoke_target', target })
          }
          onRevoke={handleRevoke}
        />
      )}
    </ConsolePage>
  )
}
