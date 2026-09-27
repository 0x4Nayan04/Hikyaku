// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listEndpoints } from '@/api/client'
import type { Paginated } from '@/api/types'
import Endpoints from '@/pages/Endpoints'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    listEndpoints: vi.fn(),
  }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const emptyPage: Paginated<never> = { data: [], has_more: false, limit: 25, offset: 0 }

let container: HTMLDivElement
let root: Root

async function renderEndpoints(path: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/endpoints" element={<Endpoints />} />
        </Routes>
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
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
  it('says there are no active endpoints when the active filter is empty', async () => {
    await renderEndpoints('/endpoints?status=active')

    expect(container.textContent).toContain('No active endpoints')
    expect(container.textContent).not.toContain('No endpoints yet')
  })
})
