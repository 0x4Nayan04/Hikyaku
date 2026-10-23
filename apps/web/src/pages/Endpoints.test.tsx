// @vitest-environment jsdom
import { createPageCache } from '@/lib/page-cache'
import { PageCacheContext } from '@/providers/page-cache-context'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listEndpoints, patchEndpoint } from '@/api/client'
import type { Endpoint, Paginated } from '@/api/types'
import Endpoints from '@/pages/Endpoints'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    listEndpoints: vi.fn(),
    patchEndpoint: vi.fn(),
  }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const emptyPage: Paginated<never> = { data: [], has_more: false, limit: 25, offset: 0 }

let pageCache: ReturnType<typeof createPageCache>
let container: HTMLDivElement
let root: Root

async function renderEndpoints(path: string) {
  await act(async () => {
    root.render(
      <PageCacheContext.Provider value={pageCache}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/endpoints" element={<Endpoints />} />
          </Routes>
        </MemoryRouter>
      </PageCacheContext.Provider>,
    )
  })
}

beforeEach(() => {
  pageCache = createPageCache()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.mocked(patchEndpoint).mockReset()
  vi.mocked(listEndpoints).mockReset()
  vi.mocked(listEndpoints).mockResolvedValue(emptyPage)
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  document.body.removeChild(container)
})

describe('Endpoints empty state', () => {
  it('defaults to the active filter', async () => {
    await renderEndpoints('/endpoints')

    expect(listEndpoints).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
      expect.anything(),
    )
    expect(container.textContent).toContain('No active endpoints')
    expect(container.textContent).not.toContain('No endpoints yet')
  })

  it('says there are no active endpoints when the active filter is empty', async () => {
    await renderEndpoints('/endpoints?status=active')

    expect(container.textContent).toContain('No active endpoints')
    expect(container.textContent).not.toContain('No endpoints yet')
  })
})

const endpoint: Endpoint = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  url: 'https://example.com/hook',
  status: 'active',
  description: 'Production',
  created_at: '2026-09-27T00:00:00Z',
}

it('restores saved endpoints on return while fetching current data', async () => {
  vi.mocked(listEndpoints).mockResolvedValueOnce({ ...emptyPage, data: [endpoint] })
  await renderEndpoints('/endpoints')
  await act(async () => root.render(null))
  vi.mocked(listEndpoints).mockImplementationOnce(() => new Promise(() => {}))
  await renderEndpoints('/endpoints')
  expect(container.textContent).toContain('Production')
  expect(container.textContent).toContain('Updating…')
})

it('clears saved endpoint and dashboard results after changing endpoint status, even if reload fails', async () => {
  vi.mocked(listEndpoints)
    .mockResolvedValueOnce({ ...emptyPage, data: [endpoint] })
    .mockRejectedValueOnce(new Error('offline'))
  vi.mocked(patchEndpoint).mockResolvedValue({ ...endpoint, status: 'disabled' })
  await renderEndpoints('/endpoints')
  const trigger = container.querySelector<HTMLButtonElement>('button[title="More actions"]')!
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  })
  const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (item) => item.textContent?.includes('Disable endpoint'),
  )
  expect(item).toBeDefined()
  await act(async () => item!.click())
  expect(patchEndpoint).toHaveBeenCalledWith(endpoint.id, { status: 'disabled' })
  expect(pageCache.endpoints.generation).toBe(1)
  expect(pageCache.dashboard.generation).toBe(1)
  expect(pageCache.endpoints.read(JSON.stringify(['active', 0, 25]))).toBeUndefined()
})
