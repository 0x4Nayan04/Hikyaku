// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Endpoint } from '@/api/types'
import { EndpointCatalogList } from '@/components/console/EndpointCatalogList'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const disabledWithDelivery: Endpoint = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  url: 'https://example.com/hook',
  status: 'disabled',
  description: 'Production',
  created_at: '2026-09-26T12:00:00.000Z',
  last_delivery: {
    id: 'delivery-1',
    status: 'failed',
    updated_at: '2026-09-26T12:05:00.000Z',
    last_error: 'timeout',
  },
}

let container: HTMLDivElement
let root: Root

async function renderList(endpoints: Endpoint[]) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <EndpointCatalogList
          endpoints={endpoints}
          togglingId={null}
          onEdit={() => undefined}
          onRotate={() => undefined}
          onToggle={() => undefined}
        />
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

describe('EndpointCatalogList disabled state', () => {
  it('says a disabled endpoint is disabled even when it has a last delivery', async () => {
    await renderList([disabledWithDelivery])

    expect(container.textContent).toContain('Disabled')
    expect(container.textContent).toContain('Failed')
    expect(container.textContent).not.toContain('Not receiving')
  })
})
