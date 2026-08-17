// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getStats, listApiKeys, listDeliveries, listEndpoints, listEvents } from '@/api/client'
import type { Paginated, Stats } from '@/api/types'
import { Dashboard } from '@/pages/Dashboard'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    getStats: vi.fn(),
    listEndpoints: vi.fn(),
    listEvents: vi.fn(),
    listDeliveries: vi.fn(),
    listApiKeys: vi.fn(),
  }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const emptyStats: Stats = {
  events_today: 0,
  deliveries_active: 0,
  deliveries_succeeded_24h: 0,
  deliveries_failed_24h: 0,
  success_rate_24h: null,
}

const activeStats: Stats = {
  events_today: 4,
  deliveries_active: 2,
  deliveries_succeeded_24h: 3,
  deliveries_failed_24h: 0,
  success_rate_24h: 1,
}

function page<T>(data: T[] = []): Paginated<T> {
  return { data, has_more: false, limit: 5, offset: 0 }
}

function hang<T>(signal?: AbortSignal): Promise<T> {
  return new Promise((_, reject) => {
    const abort = () => {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      reject(err)
    }
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}

let container: HTMLDivElement
let root: Root
let mounted = false

async function renderDashboard() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )
  })
  mounted = true
}

beforeEach(() => {
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mounted = false
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  vi.mocked(getStats).mockReset()
  vi.mocked(listEndpoints).mockReset()
  vi.mocked(listEvents).mockReset()
  vi.mocked(listDeliveries).mockReset()
  vi.mocked(listApiKeys).mockReset()
  vi.mocked(listEndpoints).mockResolvedValue(page())
  vi.mocked(listEvents).mockResolvedValue(page())
  vi.mocked(listDeliveries).mockResolvedValue(page())
  vi.mocked(listApiKeys).mockResolvedValue(page())
})

afterEach(async () => {
  if (mounted) {
    await act(async () => {
      root.unmount()
    })
    mounted = false
  }
  document.body.removeChild(container)
  vi.useRealTimers()
})

describe('Dashboard polling', () => {
  it('does not poll while the queue is idle', async () => {
    vi.mocked(getStats).mockResolvedValue(emptyStats)
    await renderDashboard()

    expect(getStats).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(getStats).toHaveBeenCalledTimes(1)
  })

  it('polls every 10s while deliveries are active and stops when the queue drains', async () => {
    vi.mocked(getStats)
      .mockResolvedValueOnce(activeStats)
      .mockResolvedValueOnce({ ...activeStats, deliveries_active: 0 })
      .mockResolvedValue(emptyStats)
    await renderDashboard()

    expect(getStats).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(getStats).toHaveBeenCalledTimes(2)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(getStats).toHaveBeenCalledTimes(2)
  })

  it('aborts in-flight stats on unmount and does not flash an error', async () => {
    let signal: AbortSignal | undefined
    vi.mocked(getStats).mockImplementation((options) => {
      signal = options?.signal
      return hang(options?.signal)
    })
    await renderDashboard()

    expect(signal?.aborted).toBe(false)
    expect(container.textContent).not.toContain('Could not load stats')
    await act(async () => {
      root.unmount()
    })
    mounted = false
    expect(signal?.aborted).toBe(true)
    expect(container.textContent).not.toContain('Could not load stats')
  })
})

describe('Dashboard empty-state probes', () => {
  it('reuses activity totals and fetches onboarding lists only when empty', async () => {
    vi.mocked(getStats).mockResolvedValue(emptyStats)
    vi.mocked(listEvents).mockResolvedValue(page())
    vi.mocked(listDeliveries).mockResolvedValue(page())
    vi.mocked(listEndpoints).mockImplementation(async () => page())
    vi.mocked(listApiKeys).mockResolvedValue(page())
    await renderDashboard()

    expect(listEvents).toHaveBeenCalledTimes(1)
    expect(listEvents).toHaveBeenCalledWith(
      { limit: 5, offset: 0 },
      { signal: expect.any(AbortSignal) },
    )
    expect(listDeliveries).toHaveBeenCalledTimes(1)
    expect(listApiKeys).toHaveBeenCalledTimes(1)
    expect(listEndpoints).toHaveBeenCalledWith(
      { status: 'disabled', limit: 1 },
      { signal: expect.any(AbortSignal) },
    )
    expect(listEndpoints).toHaveBeenCalledWith(
      { status: 'active', limit: 1 },
      { signal: expect.any(AbortSignal) },
    )
    expect(container.textContent).toContain('Create an endpoint')
  })

  it('skips onboarding probes when the tenant already has data', async () => {
    vi.mocked(getStats).mockResolvedValue(activeStats)
    await renderDashboard()

    expect(listApiKeys).not.toHaveBeenCalled()
    expect(listEndpoints).toHaveBeenCalledTimes(1)
    expect(listEndpoints).toHaveBeenCalledWith(
      { status: 'disabled', limit: 1 },
      { signal: expect.any(AbortSignal) },
    )
    expect(container.textContent).not.toContain('Create an endpoint')
  })
})
