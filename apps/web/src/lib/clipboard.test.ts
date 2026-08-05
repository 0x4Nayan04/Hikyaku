import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from '@/lib/clipboard'
import { toast } from '@/lib/toast'

vi.mock('@/lib/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('copyToClipboard', () => {
  it('explains how to recover when copying is unavailable', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })

    await expect(copyToClipboard('secret', 'API key')).resolves.toBe(false)
    expect(toast.error).toHaveBeenCalledWith("Couldn't copy api key. Copy it manually instead.")
  })
})
