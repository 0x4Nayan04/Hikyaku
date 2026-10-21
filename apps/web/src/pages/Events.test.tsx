// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listEvents } from '@/api/client'
import type { EventSummary, Paginated } from '@/api/types'
import { POLL_DEFAULT_MS } from '@/lib/ui-timing'
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

const event: EventSummary = {
  id: 'event-1',
  type: 'order.created',
  status: 'completed',
  idempotency_key: 'key-1',
  created_at: '2026-09-27T00:00:00Z',
}

function page(data: EventSummary[]): Paginated<EventSummary> {
  return { data, has_more: false, limit: 25, offset: 0 }
}

let container: HTMLDivElement
let root: Root

async function renderEvents(path = '/events') {
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

async function advance(ms = POLL_DEFAULT_MS) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
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
  vi.useRealTimers()
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

describe('Events polling', () => {
  it('does not abort an in-flight load when the quiet poll fires', async () => {
    vi.useFakeTimers()
    let finish!: (value: Paginated<EventSummary>) => void
    let signal!: AbortSignal
    vi.mocked(listEvents)
      .mockImplementationOnce((_, options) => {
        signal = options!.signal!
        return new Promise((resolve) => {
          finish = resolve
        })
      })
      .mockResolvedValue(page([event]))

    await renderEvents()
    await advance()
    expect(listEvents).toHaveBeenCalledTimes(1)
    expect(signal.aborted).toBe(false)

    await act(async () => {
      finish(page([event]))
    })
    await advance()
    expect(listEvents).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('order.created')
  })
})
