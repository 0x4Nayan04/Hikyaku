// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getEvent } from '@/api/client'
import EventDetail from '@/pages/EventDetail'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    getEvent: vi.fn(),
  }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

async function renderEvent(id: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/events/${id}`]}>
        <Routes>
          <Route path="/events/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.mocked(getEvent).mockReset()
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  document.body.removeChild(container)
})

describe('EventDetail missing event', () => {
  it('keeps the loading heading until the request settles', async () => {
    vi.mocked(getEvent).mockReturnValue(new Promise(() => undefined))
    await renderEvent('not-a-real-id')

    expect(container.querySelector('h1')?.textContent).toBe('Loading event…')
  })

  it('replaces the loading heading when the event is missing', async () => {
    vi.mocked(getEvent).mockRejectedValue(new ApiError(404, 'not_found', 'Event not found'))
    await renderEvent('not-a-real-id')

    expect(container.querySelector('h1')?.textContent).toBe('Event')
    expect(container.textContent).toContain('Event not found')
    expect(container.textContent).not.toContain('Loading event…')
  })
})
