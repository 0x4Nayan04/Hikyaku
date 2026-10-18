// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PUBLIC_API_BASE } from '@/api/client'
import { LandingHero } from '@/components/landing/LandingHero'
import { copyToClipboard } from '@/lib/clipboard'
import { buildIngestCurl } from '@/lib/tenant-onboarding'
import { SessionContext } from '@/providers/session-context'

vi.mock('@/lib/bootstrap-status', () => ({
  readBootstrapStatusCache: () => false,
  loadBootstrapStatus: async () => false,
}))
vi.mock('@/lib/clipboard', () => ({ copyToClipboard: vi.fn(async () => true) }))

function hero() {
  return (
    <StrictMode>
      <SessionContext.Provider value={{ session: null, loading: false, refresh: async () => {} }}>
        <MemoryRouter>
          <LandingHero />
        </MemoryRouter>
      </SessionContext.Provider>
    </StrictMode>
  )
}

afterEach(() => vi.restoreAllMocks())

describe('LandingHero command', () => {
  it('includes Copy and the complete command on the first render, without effects or a shell', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(hero())
    expect(host.querySelector('[aria-label="Copy ingest example"]')).not.toBeNull()
    expect(host.querySelectorAll('pre')).toHaveLength(1)
    expect(host.querySelector('pre')?.textContent).toBe(
      buildIngestCurl('whk_your_api_key', PUBLIC_API_BASE),
    )
  })

  it('keeps one complete command after Strict Mode replay and remount, and copies it', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.useFakeTimers()
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      await act(async () => root.render(hero()))
      await act(async () => root.render(null))
      await act(async () => root.render(hero()))
      expect(host.querySelectorAll('pre')).toHaveLength(1)
      const command = host.querySelector('pre')?.textContent
      expect(command).toBe(buildIngestCurl('whk_your_api_key', PUBLIC_API_BASE))
      await act(async () => {
        host.querySelector<HTMLButtonElement>('[aria-label="Copy ingest example"]')!.click()
      })
      expect(copyToClipboard).toHaveBeenCalledWith(command, 'cURL')
      expect(host.querySelector('[aria-label="Copied ingest example"]')).not.toBeNull()
      await act(async () => vi.runAllTimers())
      expect(host.querySelector('[aria-label="Copy ingest example"]')).not.toBeNull()
    } finally {
      await act(async () => root.unmount())
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })
})
