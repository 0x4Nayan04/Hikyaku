import { useState } from 'react'
import { ApiError, createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from '@/api/client'
import { PAGE_SIZE } from '@/components/console/pagination-utils'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { toast } from '@/lib/toast'
import type { ApiKey, ApiKeyWithSecret } from '@/api/types'

export function useSettingsPage(isSuperAdmin = false) {
  const {
    data: apiKeys,
    hasMore: apiKeyHasMore,
    offset: apiKeyOffset,
    setOffset: setApiKeyOffset,
    isInitial,
    isRefreshing,
    error: keysError,
    reload,
  } = usePaginatedList<ApiKey>({
    pageSize: PAGE_SIZE,
    fetchPage: ({ limit, offset, signal }) => listApiKeys({ limit, offset }, { signal }),
    fallbackError: 'Failed to load API keys',
    enabled: !isSuperAdmin,
  })

  const [creatingKey, setCreatingKey] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [rotatingId, setRotatingId] = useState<string | null>(null)
  const [secretKey, setSecretKey] = useState<ApiKeyWithSecret | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)

  async function refreshApiKeysAfterMutation(message: string) {
    const refreshed = await reload()
    if (refreshed === false) {
      toast.error(`${message}, but the API-key list could not be refreshed.`)
    }
  }

  async function handleCreateKey() {
    setCreatingKey(true)

    try {
      const created = await createApiKey()
      setSecretKey(created)
      toast.success('API key created')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create API key')
      return
    } finally {
      setCreatingKey(false)
    }

    await refreshApiKeysAfterMutation('API key created')
  }

  async function handleRevoke() {
    if (!revokeTarget) {
      return
    }

    setRevokingId(revokeTarget.id)

    try {
      await revokeApiKey(revokeTarget.id)
      setRevokeTarget(null)
      toast.success('API key revoked')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to revoke API key')
      return
    } finally {
      setRevokingId(null)
    }

    await refreshApiKeysAfterMutation('API key revoked')
  }

  async function handleRotate(id: string) {
    setRotatingId(id)

    try {
      const rotated = await rotateApiKey(id)
      setSecretKey(rotated)
      toast.success('API key rotated')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to rotate API key')
      return
    } finally {
      setRotatingId(null)
    }

    await refreshApiKeysAfterMutation('API key rotated')
  }

  return {
    apiKeys,
    apiKeyHasMore,
    apiKeyOffset,
    apiKeyPageSize: PAGE_SIZE,
    setApiKeyOffset,
    loadingKeys: isInitial || isRefreshing,
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
