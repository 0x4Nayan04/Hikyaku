import { useCallback, useEffect, useReducer } from 'react'
import {
  ApiError,
  createApiKey,
  listApiKeys,
  listEndpoints,
  revokeApiKey,
  rotateApiKey,
} from '@/api/client'
import { listEndpointSecrets, removeEndpointSecret } from '@/lib/endpoint-vault'
import { writeCachedApiKeys } from '@/lib/settings-cache'
import { toast } from '@/lib/toast'
import {
  apiKeysReducer,
  dialogReducer,
  initialApiKeysState,
  initialDialogState,
  initialVaultState,
  vaultReducer,
} from './state'

export function useSettingsPage(isSuperAdmin = false) {
  const [apiKeysState, dispatchApiKeys] = useReducer(apiKeysReducer, initialApiKeysState)
  const [vaultState, dispatchVault] = useReducer(vaultReducer, initialVaultState)
  const [dialogState, dispatchDialog] = useReducer(dialogReducer, initialDialogState)

  const loadApiKeys = useCallback(async () => {
    const result = await listApiKeys()
    writeCachedApiKeys(result.data)
    dispatchApiKeys({ type: 'load_success', apiKeys: result.data })
  }, [])

  const refreshVault = useCallback(async () => {
    const secrets = listEndpointSecrets()
    const endpointResult = await listEndpoints({ limit: 100, offset: 0 })
    const urlById = new Map(endpointResult.data.map((endpoint) => [endpoint.id, endpoint.url]))
    const entries = Object.entries(secrets).map(([endpointId, secret]) => ({
      endpointId,
      secret,
      url: urlById.get(endpointId) ?? null,
    }))
    dispatchVault({
      type: 'refresh_success',
      entries,
      endpoints: endpointResult.data,
    })
  }, [])

  useEffect(() => {
    if (isSuperAdmin) return

    let cancelled = false

    loadApiKeys()
      .catch((err) => {
        if (!cancelled) {
          dispatchApiKeys({
            type: 'load_error',
            error: err instanceof ApiError ? err.message : 'Failed to load API keys',
          })
        }
      })
      .finally(() => {
        if (!cancelled) {
          dispatchApiKeys({ type: 'load_complete' })
        }
      })

    refreshVault()
      .catch(() => {
        if (!cancelled) {
          dispatchVault({
            type: 'refresh_fallback',
            entries: Object.entries(listEndpointSecrets()).map(([endpointId, secret]) => ({
              endpointId,
              secret,
              url: null,
            })),
          })
        }
      })
      .finally(() => {
        if (!cancelled) {
          dispatchVault({ type: 'refresh_complete' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [loadApiKeys, refreshVault, isSuperAdmin])

  async function handleCreateKey() {
    dispatchDialog({ type: 'create_start' })

    try {
      const created = await createApiKey()
      dispatchDialog({ type: 'create_success', secretKey: created })
      await loadApiKeys()
      toast.success('API key created')
    } catch (err) {
      dispatchDialog({ type: 'create_end' })
      toast.error(err instanceof ApiError ? err.message : 'Failed to create API key')
    }
  }

  async function handleRevoke() {
    if (!dialogState.revokeTarget) {
      return
    }

    dispatchDialog({ type: 'revoke_start', id: dialogState.revokeTarget.id })

    try {
      await revokeApiKey(dialogState.revokeTarget.id)
      dispatchDialog({ type: 'revoke_success' })
      await loadApiKeys()
      toast.success('API key revoked')
    } catch (err) {
      dispatchDialog({ type: 'revoke_end' })
      toast.error(err instanceof ApiError ? err.message : 'Failed to revoke API key')
    }
  }

  async function handleRotate(id: string) {
    dispatchDialog({ type: 'rotate_start', id })

    try {
      const rotated = await rotateApiKey(id)
      dispatchDialog({ type: 'rotate_success', secretKey: rotated })
      await loadApiKeys()
      toast.success('API key rotated')
    } catch (err) {
      dispatchDialog({ type: 'rotate_end' })
      toast.error(err instanceof ApiError ? err.message : 'Failed to rotate API key')
    }
  }

  function handleRemoveVaultEntry(endpointId: string) {
    removeEndpointSecret(endpointId)
    dispatchVault({ type: 'remove_entry', endpointId })
    toast.success('Secret removed from this browser')
  }

  return {
    apiKeysState,
    vaultState,
    dialogState,
    dispatchDialog,
    handleCreateKey,
    handleRevoke,
    handleRotate,
    handleRemoveVaultEntry,
  }
}
