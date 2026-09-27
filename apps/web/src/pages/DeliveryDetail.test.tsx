// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getDelivery, replayDelivery } from '@/api/client'
import type { DeliveryDetail as DeliveryDetailType } from '@/api/types'
import DeliveryDetail from '@/pages/DeliveryDetail'
import { toast } from '@/lib/toast'

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    getDelivery: vi.fn(),
    replayDelivery: vi.fn(),
  }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const replayedDelivery: DeliveryDetailType = {
  id: '12345678-aaaa-bbbb-cccc-ddddeeeeffff',
  event_id: 'event-1',
  endpoint_id: 'endpoint-1',
  endpoint_url: 'https://example.com/hook',
  endpoint_status: 'active',
  status: 'failed',
  replay_count: 1,
  attempt_count: 1,
  next_retry_at: null,
  last_error: null,
  created_at: '2026-09-26T12:00:00.000Z',
  updated_at: '2026-09-26T12:05:00.000Z',
  attempts: [
    {
      run_number: 0,
      attempt_number: 1,
      http_status: 500,
      response_body: null,
      error: 'upstream',
      duration_ms: 12,
      created_at: '2026-09-26T12:00:00.000Z',
    },
    {
      run_number: 0,
      attempt_number: 2,
      http_status: 500,
      response_body: null,
      error: 'upstream',
      duration_ms: 14,
      created_at: '2026-09-26T12:01:00.000Z',
    },
    {
      run_number: 1,
      attempt_number: 1,
      http_status: 500,
      response_body: null,
      error: 'upstream',
      duration_ms: 11,
      created_at: '2026-09-26T12:05:00.000Z',
    },
  ],
}

let container: HTMLDivElement
let root: Root
let navigate: ReturnType<typeof useNavigate>
function Navigation() {
  navigate = useNavigate()
  return null
}

async function clickButton(label: string) {
  const button = Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent === label,
  )
  expect(button).toBeDefined()
  await act(async () => {
    button!.click()
  })
}

async function queueReplay() {
  await clickButton('Replay')
  await clickButton('Confirm replay')
}

async function renderDelivery(id: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/deliveries/${id}`]}>
        <Navigation />
        <Routes>
          <Route path="/deliveries/:id" element={<DeliveryDetail />} />
        </Routes>
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  vi.mocked(replayDelivery).mockReset()
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.mocked(getDelivery).mockReset()
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  document.body.removeChild(container)
  vi.useRealTimers()
})

describe('DeliveryDetail', () => {
  it('replaces the loading heading when the delivery is missing', async () => {
    vi.mocked(getDelivery).mockRejectedValue(new ApiError(404, 'not_found', 'Delivery not found'))
    await renderDelivery('not-a-real-id')

    expect(container.querySelector('h1')?.textContent).toBe('Delivery')
    expect(container.textContent).toContain('Delivery not found')
    expect(container.textContent).not.toContain('Loading delivery…')
  })

  it('labels the current run and the total after a replay', async () => {
    vi.mocked(getDelivery).mockResolvedValue(replayedDelivery)
    await renderDelivery(replayedDelivery.id)

    const label = '1 attempt this run · 3 total'
    expect(container.textContent?.split(label).length).toBe(3)
    expect(container.textContent).not.toContain('3 attempts')
    expect(replayButton()).not.toBeNull()
  })

  it('explains that replay is unavailable when the endpoint is disabled', async () => {
    vi.mocked(getDelivery).mockResolvedValue({
      ...replayedDelivery,
      endpoint_status: 'disabled',
      last_error: 'endpoint_disabled',
    })
    await renderDelivery(replayedDelivery.id)

    expect(replayButton()).toBeNull()
    expect(container.textContent).toContain(
      'Replay is unavailable because the endpoint is disabled.',
    )
    expect(container.querySelector('a[href="/endpoints?status=disabled"]')).not.toBeNull()
  })
})

function replayButton(): HTMLButtonElement | null {
  const match = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === 'Replay',
  )
  return match ?? null
}

describe('Delivery replay recovery', () => {
  it('retries failed reloads after acceptance, blocks duplicate replay and stops when terminal', async () => {
    vi.mocked(getDelivery)
      .mockResolvedValueOnce(replayedDelivery)
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockRejectedValueOnce(new Error('still unavailable'))
      .mockResolvedValue({ ...replayedDelivery, status: 'succeeded' })
    vi.mocked(replayDelivery).mockResolvedValue({ id: replayedDelivery.id, status: 'pending' })
    await renderDelivery(replayedDelivery.id)
    await queueReplay()
    expect(toast.success).toHaveBeenCalledWith('Delivery replay queued')
    expect(toast.error).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Replay queued; could not refresh delivery. Retrying…')
    expect(
      Array.from(container.querySelectorAll('button')).some(
        (button) => button.textContent === 'Replay',
      ),
    ).toBe(false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(getDelivery).toHaveBeenCalledTimes(3)
    expect(container.textContent).toContain('Retrying…')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(container.textContent).not.toContain('Replay queued;')
    expect(container.textContent).toContain('Succeeded')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(getDelivery).toHaveBeenCalledTimes(4)
    expect(replayDelivery).toHaveBeenCalledTimes(1)
  })

  it('keeps replay available when the replay request itself fails', async () => {
    vi.mocked(getDelivery).mockResolvedValue(replayedDelivery)
    vi.mocked(replayDelivery).mockRejectedValue(
      new ApiError(503, 'unavailable', 'Queue unavailable'),
    )
    await renderDelivery(replayedDelivery.id)
    await queueReplay()
    expect(toast.error).toHaveBeenCalledWith('Queue unavailable')
    expect(toast.success).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Confirm replay')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(getDelivery).toHaveBeenCalledTimes(1)
  })

  it('clears replay recovery on navigation and ignores a late response for the old delivery', async () => {
    let finishReplay!: (value: Awaited<ReturnType<typeof replayDelivery>>) => void
    vi.mocked(getDelivery)
      .mockResolvedValueOnce(replayedDelivery)
      .mockResolvedValue({ ...replayedDelivery, id: 'other-delivery' })
    vi.mocked(replayDelivery).mockReturnValue(
      new Promise((resolve) => {
        finishReplay = resolve
      }),
    )
    await renderDelivery(replayedDelivery.id)
    await queueReplay()
    await act(async () => {
      await navigate('/deliveries/other-delivery')
    })
    await act(async () => {
      finishReplay({ id: replayedDelivery.id, status: 'pending' })
    })
    expect(container.textContent).not.toContain('Replay queued;')
    expect(container.textContent).toContain('Delivery other-de')
    expect(toast.success).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(getDelivery).toHaveBeenCalledTimes(2)
  })

  it('pauses recovery polling in a hidden tab and resets it on navigation', async () => {
    vi.mocked(getDelivery)
      .mockResolvedValueOnce(replayedDelivery)
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValue({ ...replayedDelivery, id: 'other-delivery' })
    vi.mocked(replayDelivery).mockResolvedValue({ id: replayedDelivery.id, status: 'pending' })
    await renderDelivery(replayedDelivery.id)
    await queueReplay()
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(getDelivery).toHaveBeenCalledTimes(2)
    await act(async () => {
      await navigate('/deliveries/other-delivery')
    })
    expect(container.textContent).not.toContain('Replay queued;')
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(getDelivery).toHaveBeenCalledTimes(3)
  })
})
