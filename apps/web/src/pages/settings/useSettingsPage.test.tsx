// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from '@/api/client'
import type { ApiKeyWithSecret } from '@/api/types'
import { toast } from '@/lib/toast'
import { useSettingsPage } from './useSettingsPage'

vi.mock('@/api/client', async (original) => ({
  ...(await original<typeof import('@/api/client')>()),
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
  rotateApiKey: vi.fn(),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const key: ApiKeyWithSecret = {
  id: 'key-1',
  prefix: 'abc',
  api_key: 'whk_secret',
  created_at: '2026-01-01T00:00:00Z',
  revoked_at: null,
  last_used_at: null,
}
const page = { data: [key], has_more: false, limit: 25, offset: 0 }
let root: Root
let current: ReturnType<typeof useSettingsPage>
function Probe() {
  current = useSettingsPage()
  return null
}
beforeEach(async () => {
  vi.resetAllMocks()
  vi.mocked(listApiKeys).mockResolvedValue(page)
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<Probe />))
})
afterEach(async () => {
  await act(async () => root.unmount())
})

describe('API-key mutations', () => {
  it('discloses a newly created key and refreshes the list', async () => {
    vi.mocked(createApiKey).mockResolvedValue(key)
    await act(async () => current.handleCreateKey())
    expect(current.secretKey).toEqual(key)
    expect(current.creatingKey).toBe(false)
    expect(listApiKeys).toHaveBeenCalledTimes(2)
  })
  it('discloses a rotated key and revokes only the confirmed target', async () => {
    const rotated = { ...key, id: 'key-2', api_key: 'whk_rotated' }
    vi.mocked(rotateApiKey).mockResolvedValue(rotated)
    await act(async () => current.handleRotate(key.id))
    expect(rotateApiKey).toHaveBeenCalledWith(key.id)
    expect(current.secretKey).toEqual(rotated)
    expect(revokeApiKey).not.toHaveBeenCalled()
    await act(async () => current.setRevokeTarget(key))
    vi.mocked(revokeApiKey).mockResolvedValue({ ...key, revoked_at: '2026-01-02T00:00:00Z' })
    await act(async () => current.handleRevoke())
    expect(revokeApiKey).toHaveBeenCalledWith(key.id)
    expect(current.revokeTarget).toBeNull()
  })
  it('retains the confirmation target and reports a failed revoke', async () => {
    vi.mocked(revokeApiKey).mockRejectedValue(new ApiError(503, 'unavailable', 'Try later'))
    await act(async () => current.setRevokeTarget(key))
    await act(async () => current.handleRevoke())
    expect(current.revokeTarget).toEqual(key)
    expect(current.revokingId).toBeNull()
    expect(toast.error).toHaveBeenCalledWith('Try later')
    expect(listApiKeys).toHaveBeenCalledTimes(1)
  })
  it('keeps a successfully created secret visible even when refreshing fails', async () => {
    vi.mocked(createApiKey).mockResolvedValue(key)
    vi.mocked(listApiKeys).mockRejectedValueOnce(new Error('offline'))
    await act(async () => current.handleCreateKey())
    expect(current.secretKey).toEqual(key)
    expect(toast.error).toHaveBeenCalledWith(
      'API key created, but the API-key list could not be refreshed.',
    )
  })
})
