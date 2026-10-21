// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listDeliveries } from '@/api/client'
import type { Delivery, Paginated } from '@/api/types'
import { POLL_FAST_MS, POLL_SLOW_MS } from '@/lib/ui-timing'
import Deliveries from '@/pages/Deliveries'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  listDeliveries: vi.fn(),
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let container: HTMLDivElement
let root: Root
const delivery: Delivery = {
  id: 'delivery-1',
  event_id: 'event-1',
  endpoint_id: 'endpoint-1',
  endpoint_url: 'https://example.com/hook',
  status: 'pending',
  attempt_count: 0,
  replay_count: 0,
  next_retry_at: null,
  last_error: null,
  created_at: '2026-09-27T00:00:00Z',
  updated_at: '2026-09-27T00:00:00Z',
}
function page(data: Delivery[]): Paginated<Delivery> {
  return { data, has_more: false, limit: 25, offset: 0 }
}
async function renderPage() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <Deliveries />
      </MemoryRouter>,
    )
  })
}
async function advance(ms = POLL_FAST_MS) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(listDeliveries).mockReset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  setHidden(false)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('Deliveries polling', () => {
  it.each(['pending', 'in_progress'] as const)(
    'polls %s at 5s then keeps discovering at 15s',
    async (status) => {
      vi.mocked(listDeliveries)
        .mockResolvedValueOnce(page([{ ...delivery, status }]))
        .mockResolvedValue(page([{ ...delivery, status: 'succeeded' }]))
      await renderPage()
      expect(container.textContent).toContain('Live')
      await advance()
      expect(listDeliveries).toHaveBeenCalledTimes(2)
      expect(container.textContent).toContain('Live')
      await advance(POLL_SLOW_MS - 1)
      expect(listDeliveries).toHaveBeenCalledTimes(2)
      await advance(1)
      expect(listDeliveries).toHaveBeenCalledTimes(3)
    },
  )

  it.each([
    [],
    [{ ...delivery, status: 'failed' }],
    [{ ...delivery, status: 'succeeded' }],
  ] satisfies Delivery[][])(
    'discovers new deliveries from idle rows at 15s: %j',
    async (...rows) => {
      vi.mocked(listDeliveries)
        .mockResolvedValueOnce(page(rows))
        .mockResolvedValue(page([delivery]))
      await renderPage()
      await advance()
      expect(listDeliveries).toHaveBeenCalledTimes(1)
      await advance(POLL_SLOW_MS - POLL_FAST_MS)
      expect(listDeliveries).toHaveBeenCalledTimes(2)
      expect(container.textContent).toContain('example.com')
      await advance()
      expect(listDeliveries).toHaveBeenCalledTimes(3)
    },
  )

  it('pauses in hidden tabs and retries a failed refresh of active rows', async () => {
    vi.mocked(listDeliveries)
      .mockResolvedValueOnce(page([delivery]))
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValue(page([delivery]))
    await renderPage()
    setHidden(true)
    await advance()
    expect(listDeliveries).toHaveBeenCalledTimes(1)
    await act(async () => {
      setHidden(false)
    })
    expect(container.textContent).toContain('Could not load deliveries')
    expect(container.textContent).toContain('example.com')
    expect(container.textContent).not.toContain('Live')
    await advance()
    expect(listDeliveries).toHaveBeenCalledTimes(3)
    expect(container.textContent).not.toContain('Could not load deliveries')
    expect(container.textContent).toContain('Live')
  })
})

it('does not interrupt a slow initial load on poll or tab return', async () => {
  let finish!: (value: Paginated<Delivery>) => void
  let signal!: AbortSignal
  vi.mocked(listDeliveries)
    .mockImplementationOnce((_, options) => {
      signal = options!.signal!
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    .mockResolvedValue(page([delivery]))
  await renderPage()
  await advance(POLL_SLOW_MS * 2)
  await act(async () => {
    setHidden(true)
    setHidden(false)
  })
  expect(listDeliveries).toHaveBeenCalledTimes(1)
  expect(signal.aborted).toBe(false)
  await act(async () => {
    finish(page([delivery]))
  })
  await advance()
  expect(listDeliveries).toHaveBeenCalledTimes(2)
})
