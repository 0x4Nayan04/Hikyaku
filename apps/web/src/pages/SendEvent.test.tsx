// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listEndpoints } from '@/api/client'
import type { Endpoint, Paginated } from '@/api/types'
import SendEvent from '@/pages/SendEvent'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
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

let container: HTMLDivElement
let root: Root

async function renderSendEvent() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <SendEvent />
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.mocked(listEndpoints).mockReset()
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
  })
})
