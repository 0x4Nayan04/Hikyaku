// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecentActivity, type ActivityItem } from '@/components/console/RecentActivity'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const items: ActivityItem[] = [
  {
    id: 'event-complete',
    kind: 'event',
    eventType: 'order.created',
    status: 'completed',
    to: '/events/event-complete',
    createdAt: '2026-09-27T00:00:00Z',
  },
  {
    id: 'event-pending',
    kind: 'event',
    eventType: 'order.updated',
    status: 'pending',
    to: '/events/event-pending',
    createdAt: '2026-09-27T00:00:00Z',
  },
]

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  document.body.removeChild(container)
})

describe('RecentActivity event status labels', () => {
  it('uses the shared event wording', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <RecentActivity
            items={items}
            lastUpdated="2026-09-27T00:00:00Z"
            isLive={false}
            onRefresh={vi.fn()}
          />
        </MemoryRouter>,
      )
    })

    expect(container.textContent).toContain('All delivered')
    expect(container.textContent).toContain('In progress')
  })
})
