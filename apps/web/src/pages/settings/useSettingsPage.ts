import { useCallback, useEffect, useState } from 'react'
import { ApiError, createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from '@/api/client'
import { toast } from '@/lib/toast'
import type { ApiKey, ApiKeyWithSecret } from '@/api/types'

export function useSettingsPage(isSuperAdmin = false) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [keysError, setKeysError] = useState<string | null>(null)
  const [creatingKey, setCreatingKey] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [rotatingId, setRotatingId] = useState<string | null>(null)
  const [secretKey, setSecretKey] = useState<ApiKeyWithSecret | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)

  const loadApiKeys = useCallback(async () => {
    // Tenants with more than 100 keys need pagination UI.
    const result = await listApiKeys({ limit: 100 })
    setApiKeys(result.data)
    setKeysError(null)
  }, [])

  useEffect(() => {
    if (isSuperAdmin) return

    let cancelled = false

    loadApiKeys()
      .catch((err) => {
        if (!cancelled) {
          setKeysError(err instanceof ApiError ? err.message : 'Failed to load API keys')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingKeys(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [loadApiKeys, isSuperAdmin])

  async function handleCreateKey() {
    setCreatingKey(true)

    try {
      const created = await createApiKey()
      setSecretKey(created)
      setCreatingKey(false)
      await loadApiKeys()
      toast.success('API key created')
    } catch (err) {
      setCreatingKey(false)
      toast.error(err instanceof ApiError ? err.message : 'Failed to create API key')
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) {
      return
    }

    setRevokingId(revokeTarget.id)

    try {
      await revokeApiKey(revokeTarget.id)
      setRevokeTarget(null)
      setRevokingId(null)
      await loadApiKeys()
      toast.success('API key revoked')
    } catch (err) {
      setRevokingId(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to revoke API key')
    }
  }

  async function handleRotate(id: string) {
    setRotatingId(id)

    try {
      const rotated = await rotateApiKey(id)
      setSecretKey(rotated)
      setRotatingId(null)
      await loadApiKeys()
      toast.success('API key rotated')
    } catch (err) {
      setRotatingId(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to rotate API key')
    }
  }

  return {
    apiKeys,
    loadingKeys,
    keysError,
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
  }
}
