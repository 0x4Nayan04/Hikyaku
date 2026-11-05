import { SettingsApiKeyDialogs } from './SettingsApiKeyDialogs'
import { SettingsApiKeysTab } from './SettingsApiKeysTab'
import { useApiKeys } from './useApiKeys'

export function SettingsApiKeysSection() {
  const state = useApiKeys()
  return (
    <>
      <SettingsApiKeysTab
        apiKeys={state.apiKeys}
        hasMore={state.apiKeyHasMore}
        offset={state.apiKeyOffset}
        pageSize={state.apiKeyPageSize}
        loadingKeys={state.loadingKeys}
        keysError={state.keysError}
        isEmpty={state.keysEmpty}
        creatingKey={state.creatingKey}
        rotatingId={state.rotatingId}
        revokingId={state.revokingId}
        onCreateKey={state.handleCreateKey}
        onRotate={state.handleRotate}
        onRevokeClick={state.setRevokeTarget}
        onOffsetChange={state.setApiKeyOffset}
      />
      <SettingsApiKeyDialogs
        secretKey={state.secretKey}
        revokeTarget={state.revokeTarget}
        revokingId={state.revokingId}
        onSecretKeyChange={state.setSecretKey}
        onRevokeTargetChange={state.setRevokeTarget}
        onRevoke={state.handleRevoke}
      />
    </>
  )
}
