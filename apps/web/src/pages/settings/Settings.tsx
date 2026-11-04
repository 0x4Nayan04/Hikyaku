import { SettingsApiKeysSection } from '@/pages/settings/SettingsApiKeysSection'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ConsolePage } from '@/components/console/chrome/ConsolePage'
import { SettingsLayout } from '@/pages/settings/SettingsLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isPlatformContext } from '@/lib/auth/auth-redirect'
import { useSession } from '@/providers/session-context'
import { SettingsTenantTab } from '@/pages/settings/SettingsTenantTab'
import { SettingsProfileTab } from '@/pages/settings/SettingsProfileTab'

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
  const readOnly = session?.tenant?.read_only ?? false
  const isSuperAdmin = isPlatformContext(session)

  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') ?? 'profile'
  const tab =
    readOnly && requestedTab === 'api-keys'
      ? 'profile'
      : resolveSettingsTab(requestedTab, isSuperAdmin)
  const setTab = (newTab: string) => setSearchParams({ tab: newTab }, { replace: true })

  useEffect(() => {
    if (tab !== requestedTab) {
      setSearchParams({ tab }, { replace: true })
    }
  }, [tab, requestedTab, setSearchParams])

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
              {!readOnly && <TabsTrigger value="api-keys">API keys</TabsTrigger>}
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

            {!readOnly && (
              <TabsContent value="api-keys">
                <SettingsLayout>
                  <SettingsApiKeysSection />
                </SettingsLayout>
              </TabsContent>
            )}
          </>
        )}
      </Tabs>
    </ConsolePage>
  )
}
