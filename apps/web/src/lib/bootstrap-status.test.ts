// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

const getBootstrapStatus = vi.fn()

vi.mock('@/api/client', () => ({
  getBootstrapStatus: (...args: unknown[]) => getBootstrapStatus(...args),
}))

afterEach(() => {
  sessionStorage.clear()
  getBootstrapStatus.mockReset()
  vi.useRealTimers()
})

describe('bootstrap status cache', () => {
  it('returns the network result and reuses it within the TTL', async () => {
    getBootstrapStatus.mockResolvedValue({ available: true })
    const { loadBootstrapStatus, readBootstrapStatusCache } = await import('./bootstrap-status')

    await expect(loadBootstrapStatus()).resolves.toBe(true)
    await expect(loadBootstrapStatus()).resolves.toBe(true)
    expect(getBootstrapStatus).toHaveBeenCalledTimes(1)
    expect(readBootstrapStatusCache()).toBe(true)
  })

  it('refetches after the cache is invalidated', async () => {
    getBootstrapStatus
      .mockResolvedValueOnce({ available: true })
      .mockResolvedValueOnce({ available: false })
    const { loadBootstrapStatus, invalidateBootstrapStatusCache } = await import('./bootstrap-status')

    await expect(loadBootstrapStatus()).resolves.toBe(true)
    invalidateBootstrapStatusCache()
    await expect(loadBootstrapStatus()).resolves.toBe(false)
    expect(getBootstrapStatus).toHaveBeenCalledTimes(2)
  })

  it('ignores expired cache entries', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    getBootstrapStatus.mockResolvedValue({ available: true })
    const { loadBootstrapStatus, writeBootstrapStatusCache } = await import('./bootstrap-status')

    writeBootstrapStatusCache(true)
    vi.setSystemTime(new Date('2026-01-01T00:06:00Z'))
    getBootstrapStatus.mockResolvedValue({ available: false })

    await expect(loadBootstrapStatus()).resolves.toBe(false)
    expect(getBootstrapStatus).toHaveBeenCalledTimes(1)
  })
})
