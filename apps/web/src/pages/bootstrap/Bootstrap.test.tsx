// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, bootstrap, getBootstrapStatus } from '@/api/client'
import { SessionContext } from '@/providers/session-context'
import { readBootstrapStatusCache } from '@/lib/auth/bootstrap-status'
import Bootstrap from '@/pages/bootstrap/Bootstrap'

vi.mock('@/api/client', async (original) => ({
  ...(await original<typeof import('@/api/client')>()),
  bootstrap: vi.fn(),
  getBootstrapStatus: vi.fn(),
}))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root: Root
let container: HTMLDivElement
let destination: ReturnType<typeof useLocation> | undefined
function Login() {
  destination = useLocation()
  return <p>Login destination</p>
}
beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  destination = undefined
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  vi.mocked(getBootstrapStatus).mockResolvedValue({ available: true })
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  sessionStorage.clear()
})
async function render() {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={['/bootstrap']}>
        <SessionContext.Provider
          value={{ session: null, loading: false, refresh: async () => undefined }}
        >
          <Routes>
            <Route path="/bootstrap" element={<Bootstrap />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </SessionContext.Provider>
      </MemoryRouter>,
    ),
  )
}
async function submit() {
  await act(async () =>
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
}
describe('first-run setup', () => {
  it('redirects to login with an explanation when setup is closed', async () => {
    vi.mocked(getBootstrapStatus).mockResolvedValue({ available: false })
    await render()
    expect(destination?.state).toMatchObject({ banner: 'already_set_up' })
    expect(bootstrap).not.toHaveBeenCalled()
  })
  it('shows an availability failure and supports retry', async () => {
    vi.mocked(getBootstrapStatus).mockRejectedValueOnce(new Error('offline'))
    await render()
    expect(container.textContent).toContain('Setup check failed')
    const retry = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Try again',
    )!
    await act(async () => retry.click())
    expect(container.textContent).toContain('Create account and workspace')
    expect(getBootstrapStatus).toHaveBeenCalledTimes(2)
  })
  it('keeps forbidden submit errors on the form', async () => {
    vi.mocked(bootstrap).mockRejectedValue(new ApiError(403, 'forbidden', 'Closed'))
    await render()
    await submit()
    expect(container.textContent).toContain('Bootstrap is disabled because a user already exists')
    expect(destination).toBeUndefined()
  })
  it('closes the shared availability cache and hands off to login after success', async () => {
    vi.mocked(bootstrap).mockResolvedValue({
      user: { id: 'user', email: 'owner@example.com', is_super_admin: true },
    })
    await render()
    await submit()
    expect(readBootstrapStatusCache()).toBe(false)
    expect(destination?.state).toMatchObject({ banner: 'bootstrap_complete' })
  })
})
