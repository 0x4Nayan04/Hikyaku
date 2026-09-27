// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listEvents } from '@/api/client'
import type { Paginated } from '@/api/types'
import Events from '@/pages/Events'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    listEvents: vi.fn(),
  }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const emptyPage: Paginated<never> = { data: [], has_more: false, limit: 25, offset: 0 }

let container: HTMLDivElement
let root: Root

async function renderEvents(path: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/events" element={<Events />} />
        </Routes>
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.mocked(listEvents).mockReset()
  vi.mocked(listEvents).mockResolvedValue(emptyPage)
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  document.body.removeChild(container)
})

describe('Events status filter', () => {
  it('requests only failed events when the status query is failed', async () => {
    await renderEvents('/events?status=failed')

    expect(listEvents).toHaveBeenCalledWith(
      { limit: 25, offset: 0, status: 'failed' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(container.textContent).toContain('No events match this status')
  })
})
