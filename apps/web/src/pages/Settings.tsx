import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ConsolePage } from '@/components/console/ConsolePage'
import { SettingsLayout } from '@/components/console/SettingsLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/providers/session-context'
import { SettingsApiKeyDialogs } from '@/pages/settings/SettingsApiKeyDialogs'
import { SettingsApiKeysTab } from '@/pages/settings/SettingsApiKeysTab'
import { SettingsTenantTab } from '@/pages/settings/SettingsTenantTab'
import { SettingsProfileTab } from '@/pages/settings/SettingsProfileTab'
import { useSettingsPage } from '@/pages/settings/useSettingsPage'

const SETTINGS_TABS = ['profile', 'tenant', 'api-keys'] as const
type SettingsTab = (typeof SETTINGS_TABS)[number]
const TENANT_ONLY_TABS = new Set<SettingsTab>(['tenant', 'api-keys'])

function isSettingsTab(value: string): value is SettingsTab {
  return (SETTINGS_TABS as readonly string[]).includes(value)
}

function resolveSettingsTab(requestedTab: string, isSuperAdmin: boolean): SettingsTab {
  if (!isSettingsTab(requestedTab)) return 'profile'
  if (isSuperAdmin && TENANT_ONLY_TABS.has(requestedTab)) return 'profile'
  return requestedTab
}

export default function Settings() {
  const { session } = useSession()
  const isSuperAdmin = (session?.user.is_super_admin ?? false) && !session?.tenant

  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') ?? 'profile'
  const tab = resolveSettingsTab(requestedTab, isSuperAdmin)
  const setTab = (newTab: string) => setSearchParams({ tab: newTab }, { replace: true })

  useEffect(() => {
    if (tab !== requestedTab) {
      setSearchParams({ tab }, { replace: true })
    }
  }, [tab, requestedTab, setSearchParams])

  const {
    apiKeys,
    apiKeyHasMore,
    apiKeyOffset,
    apiKeyPageSize,
    setApiKeyOffset,
    loadingKeys,
    keysError,
    keysEmpty,
    creatingKey,
    revokingId,
    rotatingId,
    secretKey,
    revokeTarget,
    setSecretKey,
    setRevokeTarget,
    handleCreateKey,
    handleRevoke,
    handleRotate,
  } = useSettingsPage(isSuperAdmin)

  return (
    <ConsolePage
      marker="Account"
      title="Settings"
      description={
        isSuperAdmin
          ? 'Account password and platform admin access.'
          : 'Profile, API keys, and workspace identity.'
      }
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {!isSuperAdmin && (
            <>
              <TabsTrigger value="tenant">Workspace</TabsTrigger>
              <TabsTrigger value="api-keys">API keys</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="profile">
          <SettingsProfileTab />
        </TabsContent>

        {!isSuperAdmin && (
          <>
            <TabsContent value="tenant">
              <SettingsLayout>
                <SettingsTenantTab />
              </SettingsLayout>
            </TabsContent>

            <TabsContent value="api-keys">
              <SettingsLayout>
                <SettingsApiKeysTab
                  apiKeys={apiKeys}
                  hasMore={apiKeyHasMore}
                  offset={apiKeyOffset}
                  pageSize={apiKeyPageSize}
                  loadingKeys={loadingKeys}
                  keysError={keysError}
                  isEmpty={keysEmpty}
                  creatingKey={creatingKey}
                  rotatingId={rotatingId}
                  revokingId={revokingId}
                  onCreateKey={handleCreateKey}
                  onRotate={handleRotate}
                  onRevokeClick={setRevokeTarget}
                  onOffsetChange={setApiKeyOffset}
                />
              </SettingsLayout>
            </TabsContent>
          </>
        )}
      </Tabs>

      {!isSuperAdmin && (
        <SettingsApiKeyDialogs
          secretKey={secretKey}
          revokeTarget={revokeTarget}
          revokingId={revokingId}
          onSecretKeyChange={setSecretKey}
          onRevokeTargetChange={setRevokeTarget}
          onRevoke={handleRevoke}
        />
      )}
    </ConsolePage>
  )
}
