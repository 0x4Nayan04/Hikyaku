// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getDelivery } from '@/api/client'
import type { DeliveryDetail as DeliveryDetailType } from '@/api/types'
import DeliveryDetail from '@/pages/DeliveryDetail'

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

async function renderDelivery(id: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/deliveries/${id}`]}>
        <Routes>
          <Route path="/deliveries/:id" element={<DeliveryDetail />} />
        </Routes>
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
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
})

describe('DeliveryDetail', () => {
  it('replaces the loading heading when the delivery is missing', async () => {
    vi.mocked(getDelivery).mockRejectedValue(new ApiError(404, 'not_found', 'Delivery not found'))
    await renderDelivery('not-a-real-id')

    expect(container.querySelector('h1')?.textContent).toBe('Delivery')
    expect(container.textContent).toContain('Delivery not found')
    expect(container.textContent).not.toContain('Loading delivery…')
  })

  it('counts every recorded attempt after a replay', async () => {
    vi.mocked(getDelivery).mockResolvedValue(replayedDelivery)
    await renderDelivery(replayedDelivery.id)

    expect(container.textContent?.match(/3 attempts/g)?.length).toBe(2)
    expect(container.textContent).not.toContain('1 attempt')
    expect(replayButton()).not.toBeNull()
  })

  it('hides replay when the endpoint is disabled', async () => {
    vi.mocked(getDelivery).mockResolvedValue({
      ...replayedDelivery,
      endpoint_status: 'disabled',
      last_error: 'endpoint_disabled',
    })
    await renderDelivery(replayedDelivery.id)

    expect(replayButton()).toBeNull()
  })
})

function replayButton(): HTMLButtonElement | null {
  const match = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === 'Replay',
  )
  return match ?? null
}
