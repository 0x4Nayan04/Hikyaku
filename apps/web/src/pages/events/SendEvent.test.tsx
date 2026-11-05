// @vitest-environment jsdom
import { SessionTestProvider } from '@/testing/SessionTestProvider'
import { createPageCache } from '@/lib/page-cache'
import { PageCacheContext } from '@/providers/page-cache-context'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getEvent, listEndpoints, sendEvent } from '@/api/client'
import type { Endpoint, EventDetail, Paginated } from '@/api/types'
import SendEvent from '@/pages/events/SendEvent'
import { POLL_FAST_MS } from '@/lib/ui-timing'

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    getEvent: vi.fn(),
    listEndpoints: vi.fn(),
    sendEvent: vi.fn(),
  }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function page<T>(data: T[] = []): Paginated<T> {
  return { data, has_more: false, limit: 1, offset: 0 }
}

const disabledEndpoint = {
  id: 'endpoint-disabled',
  status: 'disabled',
} as Endpoint

let pageCache: ReturnType<typeof createPageCache>
let container: HTMLDivElement
let root: Root

async function renderSendEvent() {
  await act(async () => {
    root.render(
      <PageCacheContext.Provider value={pageCache}>
        <MemoryRouter>
          <SessionTestProvider>
            <SendEvent />
          </SessionTestProvider>
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
  vi.mocked(listEndpoints).mockReset()
  vi.mocked(sendEvent).mockReset()
  vi.mocked(getEvent).mockReset()
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  document.body.removeChild(container)
})

describe('SendEvent endpoint gate', () => {
  it('asks to create an endpoint when the workspace has none', async () => {
    vi.mocked(listEndpoints).mockResolvedValue(page())
    await renderSendEvent()

    expect(container.textContent).toContain('Create an endpoint first')
    expect(container.textContent).not.toContain('Send test event')
  })

  it('asks to enable an endpoint when every endpoint is disabled', async () => {
    vi.mocked(listEndpoints).mockImplementation(async (params) =>
      page(params.status === 'active' ? [] : [disabledEndpoint]),
    )
    await renderSendEvent()

    expect(container.textContent).toContain('Enable an endpoint')
    expect(container.textContent).not.toContain('Create an endpoint first')
    expect(container.textContent).not.toContain('Send test event')
  })

  it('shows the form when an endpoint is active', async () => {
    vi.mocked(listEndpoints).mockImplementation(async (params) =>
      page(params.status === 'active' ? [disabledEndpoint] : [disabledEndpoint]),
    )
    await renderSendEvent()

    expect(container.textContent).toContain('Send test event')
    expect(container.textContent).not.toContain('Create an endpoint first')
    expect(container.textContent).toContain('Sends a real webhook to the active endpoints.')
    expect(container.querySelector('a[href="/docs#ingest"]')).not.toBeNull()
    expect(container.querySelector('a[href="/docs#api-only-path"]')?.textContent).toContain(
      'Terminal walkthrough',
    )
  })
})

describe('SendEvent accepted status', () => {
  it('replaces the ingest pending badge once the event is terminal', async () => {
    const createdAt = '2026-10-21T00:00:00.000Z'
    vi.mocked(listEndpoints).mockImplementation(async (params) =>
      page(params.status === 'active' ? [disabledEndpoint] : [disabledEndpoint]),
    )
    vi.mocked(sendEvent).mockResolvedValue({
      id: 'evt-1',
      status: 'pending',
      created_at: createdAt,
    })
    vi.mocked(getEvent).mockResolvedValue({
      id: 'evt-1',
      idempotency_key: 'key',
      type: 'order.paid',
      status: 'partial_failure',
      created_at: createdAt,
      payload: { order_id: '123' },
      deliveries_summary: { total: 2, succeeded: 1, failed: 1, pending: 0 },
    } satisfies EventDetail)

    await renderSendEvent()
    const form = container.querySelector('#send-event-form')
    expect(form).not.toBeNull()

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(pageCache.events.generation).toBe(1)
    expect(pageCache.deliveries.generation).toBe(1)
    expect(pageCache.dashboard.generation).toBe(1)
    expect(pageCache.endpoints.generation).toBe(1)
    expect(container.textContent).toContain('Partial Failure')
    expect(container.textContent).not.toContain('In progress')
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function acceptPendingEvent() {
  vi.mocked(listEndpoints).mockResolvedValue(page([disabledEndpoint]))
  vi.mocked(sendEvent).mockResolvedValue({
    id: 'evt-pending',
    status: 'pending',
    created_at: '2026-10-21T00:00:00Z',
  })
  await renderSendEvent()
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

it('does not restore an old accepted event after Send another resets the form', async () => {
  const pending = deferred<EventDetail>()
  vi.mocked(getEvent).mockReturnValue(pending.promise)
  await acceptPendingEvent()
  const signal = vi.mocked(getEvent).mock.calls[0][1]?.signal
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Send another'))!
      .click()
  })
  await act(async () => {
    pending.resolve({ id: 'evt-pending', status: 'failed' } as EventDetail)
  })
  expect(container.textContent).not.toContain('Accepted event')
  expect(container.textContent).not.toContain('evt-pending')
  expect(signal?.aborted).toBe(true)
})

it('shows a recoverable status refresh error and clears it when polling succeeds', async () => {
  vi.useFakeTimers()
  try {
    vi.mocked(getEvent)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({
        id: 'evt-pending',
        status: 'completed',
      } as EventDetail)
    await acceptPendingEvent()
    expect(container.textContent).toContain('Could not update event status')
    expect(container.textContent).toContain('Status will retry automatically.')
    expect(container.textContent).toContain('evt-pending')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_FAST_MS)
    })
    expect(container.textContent).not.toContain('Could not update event status')
    expect(container.textContent).toContain('All delivered')
  } finally {
    vi.useRealTimers()
  }
})

it('keeps a newer accepted event when an earlier status request resolves late', async () => {
  const pending = deferred<EventDetail>()
  vi.mocked(getEvent)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue({
      id: 'evt-new',
      status: 'pending',
    } as EventDetail)
  await acceptPendingEvent()
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Send another'))!
      .click()
  })
  vi.mocked(sendEvent).mockResolvedValue({
    id: 'evt-new',
    status: 'pending',
    created_at: '2026-10-21T00:00:00Z',
  })
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await act(async () => {
    pending.resolve({ id: 'evt-pending', status: 'failed' } as EventDetail)
  })
  expect(container.textContent).toContain('evt-new')
  expect(container.textContent).not.toContain('evt-pending')
})

it('does not overlap the initial status request with timer refreshes', async () => {
  vi.useFakeTimers()
  try {
    const pending = deferred<EventDetail>()
    vi.mocked(getEvent).mockReturnValue(pending.promise)
    await acceptPendingEvent()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_FAST_MS * 2)
    })
    expect(getEvent).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.resolve({ id: 'evt-pending', status: 'completed' } as EventDetail)
    })
    expect(container.textContent).toContain('All delivered')
  } finally {
    vi.useRealTimers()
  }
})
