// @vitest-environment jsdom
import { getStats, listApiKeys, listDeliveries, listEndpoints, listEvents } from '@/api/client';
import type { Paginated, Stats } from '@/api/types';
import { Dashboard } from '@/pages/Dashboard';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  it('polls while the queue is idle', async () => {
    vi.mocked(getStats).mockResolvedValue(emptyStats)
    await renderDashboard()

    expect(getStats).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(getStats).toHaveBeenCalledTimes(4)
  })

  it('keeps polling every 10s after the queue drains', async () => {
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
    expect(getStats).toHaveBeenCalledTimes(4)
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
  it('describes disabled endpoints without claiming a total from the one-row probe', async () => {
    vi.mocked(getStats).mockResolvedValue(activeStats)
    vi.mocked(listEndpoints).mockResolvedValue(page([{ id: 'disabled' }] as never[]))
    await renderDashboard()

    expect(container.textContent).toContain('Disabled endpoints present')
    expect(container.textContent).not.toContain('1 disabled endpoint')
  })

  it('asks to enable an endpoint when only disabled endpoints exist', async () => {
    vi.mocked(getStats).mockResolvedValue(emptyStats)
    vi.mocked(listEvents).mockResolvedValue(page())
    vi.mocked(listDeliveries).mockResolvedValue(page())
    vi.mocked(listEndpoints).mockImplementation(async (params) => {
      if (params?.status === 'disabled') return page([{ id: 'disabled' }] as never[])
      return page()
    })
    await renderDashboard()

    expect(container.textContent).toContain('Enable an endpoint')
    expect(container.textContent).not.toContain('Create an endpoint')
    expect(container.querySelector('a[href="/endpoints?status=disabled"]')).not.toBeNull()
  })

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
    expect(listApiKeys).not.toHaveBeenCalled()
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

  it('surfaces a failed endpoint check without inventing onboarding and recovers', async () => {
    vi.mocked(getStats).mockResolvedValue(emptyStats)
    vi.mocked(listEndpoints).mockImplementation(async (params) => {
      if (params?.status === 'active') throw new Error('unavailable')
      return page()
    })
    await renderDashboard()

    expect(container.textContent).toContain('Could not check endpoints')
    expect(container.textContent).not.toContain('Create an endpoint')
    expect(container.textContent).toContain('Metrics')

    vi.mocked(listEndpoints).mockResolvedValue(page())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(container.textContent).not.toContain('Could not check endpoints')
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

  it('links active and 24h counts to the same filters the numbers use', async () => {
    vi.mocked(getStats).mockResolvedValue({
      ...activeStats,
      deliveries_failed_24h: 1,
      success_rate_24h: 0.75,
    })
    await renderDashboard()

    expect(container.querySelector('a[href="/deliveries?status=open"]')).not.toBeNull()
    expect(container.querySelector('a[href="/deliveries?status=pending"]')).toBeNull()
    expect(
      container.querySelector('a[href="/deliveries?status=succeeded&updated_within=24h"]'),
    ).not.toBeNull()
    expect(
      container.querySelector('a[href="/deliveries?status=failed&updated_within=24h"]'),
    ).not.toBeNull()
    expect(container.textContent).toContain('active deliveries')
    expect(container.textContent).not.toContain('queue depth')
  })
})

it('refreshes on tab return and skips slow initial loads without changing the 10s cadence', async () => {
  let finish!: (value: Stats) => void
  let signal!: AbortSignal
  vi.mocked(getStats)
    .mockImplementationOnce((options) => {
      signal = options!.signal!
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    .mockResolvedValue(activeStats)
  await renderDashboard()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000)
  })
  expect(getStats).toHaveBeenCalledTimes(1)
  expect(signal.aborted).toBe(false)
  const visibility = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
    document.dispatchEvent(new Event('visibilitychange'))
  }
  await act(async () => {
    visibility(true)
    visibility(false)
  })
  expect(getStats).toHaveBeenCalledTimes(1)
  await act(async () => {
    finish(activeStats)
  })
  await act(async () => {
    visibility(true)
    await vi.advanceTimersByTimeAsync(30_000)
  })
  expect(getStats).toHaveBeenCalledTimes(1)
  await act(async () => {
    visibility(false)
  })
  expect(getStats).toHaveBeenCalledTimes(2)
  expect(listEvents).toHaveBeenCalledTimes(2)
  expect(listDeliveries).toHaveBeenCalledTimes(2)
  expect(listEndpoints).toHaveBeenCalledTimes(2)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(9_999)
  })
  expect(getStats).toHaveBeenCalledTimes(2)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
  expect(getStats).toHaveBeenCalledTimes(3)
})

it('cancels the remaining failed batch and recovers on the next refresh', async () => {
  let signal: AbortSignal | undefined
  vi.mocked(getStats).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(activeStats)
  vi.mocked(listEvents)
    .mockImplementationOnce((_, options) => {
      signal = options?.signal
      return hang(options?.signal)
    })
    .mockResolvedValue(page())
  await renderDashboard()
  expect(signal?.aborted).toBe(true)
  expect(container.textContent).toContain('Could not load stats')
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000)
  })
  expect(getStats).toHaveBeenCalledTimes(2)
  expect(container.textContent).not.toContain('Could not load stats')
})
