// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listDeliveries } from '@/api/client'
import type { Delivery, Paginated } from '@/api/types'
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
async function advance() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000)
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
    'polls %s rows until terminal and hides Live',
    async (status) => {
      vi.mocked(listDeliveries)
        .mockResolvedValueOnce(page([{ ...delivery, status }]))
        .mockResolvedValue(page([{ ...delivery, status: 'succeeded' }]))
      await renderPage()
      expect(container.textContent).toContain('Live')
      await advance()
      expect(listDeliveries).toHaveBeenCalledTimes(2)
      expect(container.textContent).not.toContain('Live')
      await advance()
      expect(listDeliveries).toHaveBeenCalledTimes(2)
    },
  )

  it.each([
    [],
    [{ ...delivery, status: 'failed' }],
    [{ ...delivery, status: 'succeeded' }],
  ] satisfies Delivery[][])('does not poll idle rows: %j', async (...rows) => {
    vi.mocked(listDeliveries).mockResolvedValue(page(rows))
    await renderPage()
    await advance()
    expect(listDeliveries).toHaveBeenCalledTimes(1)
    expect(container.textContent).not.toContain('Live')
  })

  it('pauses in hidden tabs and retries a failed refresh of active rows', async () => {
    vi.mocked(listDeliveries)
      .mockResolvedValueOnce(page([delivery]))
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValue(page([delivery]))
    await renderPage()
    setHidden(true)
    await advance()
    expect(listDeliveries).toHaveBeenCalledTimes(1)
    setHidden(false)
    await advance()
    expect(container.textContent).toContain('Could not load deliveries')
    expect(container.textContent).toContain('example.com')
    expect(container.textContent).not.toContain('Live')
    await advance()
    expect(listDeliveries).toHaveBeenCalledTimes(3)
    expect(container.textContent).not.toContain('Could not load deliveries')
    expect(container.textContent).toContain('Live')
  })
})
