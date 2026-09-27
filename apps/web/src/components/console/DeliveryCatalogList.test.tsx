// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Delivery } from '@/api/types'
import { DeliveryCatalogList } from '@/components/console/DeliveryCatalogList'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const replayed: Delivery = {
  id: '12345678-aaaa-bbbb-cccc-ddddeeeeffff',
  event_id: 'event-1',
  endpoint_id: 'endpoint-1',
  endpoint_url: 'https://example.com/hook',
  status: 'failed',
  replay_count: 1,
  attempt_count: 1,
  next_retry_at: null,
  last_error: null,
  created_at: '2026-09-26T12:00:00.000Z',
  updated_at: '2026-09-26T12:05:00.000Z',
}

const currentRunOnly: Delivery = {
  ...replayed,
  id: '22345678-aaaa-bbbb-cccc-ddddeeeeffff',
  replay_count: 0,
  attempt_count: 2,
}

let container: HTMLDivElement
let root: Root

async function renderList(deliveries: Delivery[]) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <DeliveryCatalogList deliveries={deliveries} />
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  document.body.removeChild(container)
})

describe('DeliveryCatalogList attempts', () => {
  it('labels a replay separately from the current-run count', async () => {
    await renderList([replayed, currentRunOnly])

    expect(container.textContent).toContain('1 attempt · replayed 1x')
    expect(container.textContent).toContain('2 attempts')
    expect(container.textContent).not.toContain('this run')
  })
})
