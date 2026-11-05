// @vitest-environment jsdom
import { SessionTestProvider } from '@/testing/SessionTestProvider'
import { createPageCache } from '@/lib/page-cache'
import { PageCacheContext } from '@/providers/page-cache-context'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listEvents } from '@/api/client'
import type { EventSummary, Paginated } from '@/api/types'
import { POLL_DEFAULT_MS } from '@/lib/ui-timing'
import Events from '@/pages/events/Events'

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

let pageCache: ReturnType<typeof createPageCache>
let container: HTMLDivElement
let root: Root

async function renderEvents(path = '/events') {
  await act(async () => {
    root.render(
      <PageCacheContext.Provider value={pageCache}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/events"
              element={
                <SessionTestProvider>
                  <Events />
                </SessionTestProvider>
              }
            />
            <Route path="/events/:id" element={<EventRouteProbe />} />
          </Routes>
        </MemoryRouter>
      </PageCacheContext.Provider>,
    )
  })
}

function EventRouteProbe() {
  const location = useLocation()
  return <p data-testid="event-state">{JSON.stringify(location.state)}</p>
}

async function advance(ms = POLL_DEFAULT_MS) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  pageCache = createPageCache()
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

it('uses an event anchor carrying the current list return location', async () => {
  vi.mocked(listEvents).mockResolvedValue(page([event]))
  await renderEvents('/events?status=completed#latest')

  const row = container.querySelector('tbody tr')
  const anchor = container.querySelector('tbody a') as HTMLAnchorElement | null
  expect(row?.getAttribute('role')).toBeNull()
  expect(row?.getAttribute('tabindex')).toBeNull()
  expect(anchor?.getAttribute('href')).toBe('/events/event-1')

  await act(async () => anchor?.click())
  expect(container.textContent).toContain('"listReturnTo":"/events?status=completed#latest"')
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

it('restores matching rows on return but does not reuse them for a different status', async () => {
  vi.mocked(listEvents).mockResolvedValueOnce(page([event]))
  await renderEvents()
  await act(async () => root.render(null))
  vi.mocked(listEvents).mockImplementation(() => new Promise(() => {}))
  await renderEvents()
  expect(container.textContent).toContain('order.created')
  expect(container.textContent).toContain('Updating…')
  await act(async () => root.render(null))
  await renderEvents('/events?status=failed')
  expect(container.textContent).not.toContain('order.created')
})

it('refreshes stale event rows immediately on tab return, without hidden polling or duplicate loads', async () => {
  vi.useFakeTimers()
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  vi.mocked(listEvents)
    .mockResolvedValueOnce(emptyPage)
    .mockResolvedValue(page([event]))
  await renderEvents()
  expect(container.textContent).toContain('No events yet')

  await act(async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(POLL_DEFAULT_MS * 3)
  })
  expect(listEvents).toHaveBeenCalledTimes(1)

  await act(async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(listEvents).toHaveBeenCalledTimes(2)
  expect(container.textContent).toContain('order.created')
})

it.each(['pending', 'completed', 'partial_failure', 'failed', 'no_recipients', 'all', 'invalid'])(
  'preserves event status filter %s',
  async (status) => {
    vi.mocked(listEvents).mockResolvedValue(emptyPage)
    await renderEvents(`/events?status=${status}`)
    expect(listEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        status: status === 'all' || status === 'invalid' ? undefined : status,
      }),
      expect.anything(),
    )
  },
)
