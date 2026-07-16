import { Link } from 'react-router-dom'
import { DataPanel } from '@/components/console/DataPanel'
import { PageLoading } from '@/components/console/PageLoading'
import {
  SettingsCatalogList,
  SettingsCatalogRow,
  SettingsCopyValue,
} from '@/components/console/SettingsCatalog'
import { useSession } from '@/providers/session-context'

export function SettingsTenantTab() {
  const { session, loading: loadingSession } = useSession()
  const tenantName = session?.tenant?.name

  return (
    <DataPanel
      title="Workspace identity"
      footer={
        <p className="settings-panel-footnote">
          Signed-in user details and password are on{' '}
          <Link to="/settings?tab=profile" className="text-primary hover:underline">
            Profile
          </Link>
          .
        </p>
      }
    >
      {loadingSession && !session ? (
        <div className="p-5">
          <PageLoading variant="inline" />
        </div>
      ) : session?.tenant ? (
        <SettingsCatalogList>
          <SettingsCatalogRow label="Tenant name">
            <span className="font-medium">{tenantName}</span>
          </SettingsCatalogRow>
          <SettingsCatalogRow label="Tenant ID" layout="stacked">
            <SettingsCopyValue
              value={session.tenant.id}
              copyLabel="Tenant ID"
              buttonLabel="Copy ID"
            />
          </SettingsCatalogRow>
        </SettingsCatalogList>
      ) : (
        <div className="px-5 py-4">
          <p className="text-sm text-muted-strong">Workspace details are unavailable.</p>
        </div>
      )}
    </DataPanel>
  )
}
