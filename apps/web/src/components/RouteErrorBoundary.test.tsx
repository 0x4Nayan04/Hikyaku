// @vitest-environment jsdom
import { act, lazy, Suspense, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RouteErrorBoundary } from './RouteErrorBoundary'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('contains a rejected route import, keeps the shell and reloads only on request', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const reload = vi.fn()
  vi.stubGlobal('location', { reload })
  const BrokenPage = lazy(() => Promise.reject(new Error('private stack details')))

  await act(async () => {
    root.render(
      <MemoryRouter>
        <nav>Console navigation</nav>
        <RouteErrorBoundary>
          <Suspense fallback="Loading">
            <BrokenPage />
          </Suspense>
        </RouteErrorBoundary>
      </MemoryRouter>,
    )
  })

  expect(container.querySelector('nav')?.textContent).toBe('Console navigation')
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    'Could not load this page',
  )
  expect(container.textContent).not.toContain('private stack details')
  expect(reload).not.toHaveBeenCalled()
  await act(async () => container.querySelector('button')!.click())
  expect(reload).toHaveBeenCalledTimes(1)
})

it('recovers on navigation and provides a main landmark for application failures', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  function BrokenPage(): never {
    throw new Error('render failed')
  }
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/broken']}>
        <Link to="/working">Working page</Link>
        <RouteErrorBoundary fullPage>
          <Routes>
            <Route path="/broken" element={<BrokenPage />} />
            <Route path="/working" element={<h1>Working</h1>} />
          </Routes>
        </RouteErrorBoundary>
      </MemoryRouter>,
    )
  })
  expect(container.querySelector('main#main-content [role="alert"]')).not.toBeNull()
  await act(async () => container.querySelector('a')!.click())
  expect(container.querySelector('[role="alert"]')).toBeNull()
  expect(container.querySelector('h1')?.textContent).toBe('Working')
})

it('does not remount healthy content when filters change', async () => {
  const mounted = vi.fn()
  const unmounted = vi.fn()
  function HealthyPage() {
    const location = useLocation()
    useEffect(() => {
      mounted()
      return unmounted
    }, [])
    return (
      <>
        <Link to="?status=failed">Filter</Link>
        <p>{location.search}</p>
      </>
    )
  }
  await act(async () => {
    root.render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <HealthyPage />
        </RouteErrorBoundary>
      </MemoryRouter>,
    )
  })
  await act(async () => container.querySelector('a')!.click())
  expect(container.querySelector('p')?.textContent).toBe('?status=failed')
  expect(mounted).toHaveBeenCalledTimes(1)
  expect(unmounted).not.toHaveBeenCalled()
})
