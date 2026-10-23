// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { logout } from '@/api/client'
import type { MeResponse } from '@/api/types'
import { LandingNavbar } from '@/components/landing/LandingNavbar'
import { toast } from '@/lib/toast'
import { SessionContext } from '@/providers/session-context'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return { ...actual, logout: vi.fn() }
})

vi.mock('@/lib/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const session: MeResponse = {
  user: {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    tenant_id: 'tenant-1',
    is_super_admin: false,
  },
  tenant: { id: 'tenant-1', name: 'Test Workspace' },
}

class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let container: HTMLDivElement
let root: Root
let refresh: () => Promise<void>

async function renderNav(currentSession: MeResponse | null) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  refresh = vi.fn().mockResolvedValue(undefined)

  await act(async () => {
    root.render(
      <MemoryRouter>
        <SessionContext.Provider value={{ session: currentSession, loading: false, refresh }}>
          <LandingNavbar />
        </SessionContext.Provider>
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  vi.mocked(logout).mockReset().mockResolvedValue(undefined)
  vi.mocked(toast.error).mockReset()
})

afterEach(async () => {
  await act(async () => root.unmount())
  document.body.removeChild(container)
  vi.unstubAllGlobals()
})

it('shows Sign out next to Dashboard when signed in', async () => {
  await renderNav(session)

  const signOut = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === 'Sign out',
  )
  expect(signOut).toBeTruthy()
  expect(container.textContent).toContain('Dashboard')
})

it('hides Sign out when signed out', async () => {
  await renderNav(null)

  const signOut = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === 'Sign out',
  )
  expect(signOut).toBeUndefined()
  expect(container.textContent).toContain('Sign in')
})

it('opens the mobile drawer with the page sections', async () => {
  await renderNav(session)

  const openMenu = container.querySelector<HTMLButtonElement>('button[aria-label="Open menu"]')
  expect(openMenu).toBeTruthy()
  await act(async () => openMenu?.click())

  const drawer = container.querySelector('#landing-mobile-menu')
  expect(drawer).toBeTruthy()
  expect(drawer?.textContent).toContain('Features')
  expect(drawer?.textContent).toContain('Sign out')
})

it('signs out from the landing header without leaving the page', async () => {
  await renderNav(session)

  const signOut = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === 'Sign out',
  )
  await act(async () => signOut?.click())

  expect(logout).toHaveBeenCalledOnce()
  expect(refresh).toHaveBeenCalledOnce()
})

it('keeps the session when logout fails', async () => {
  vi.mocked(logout).mockRejectedValue(new Error('network failure'))
  await renderNav(session)

  const signOut = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === 'Sign out',
  )
  await act(async () => signOut?.click())

  expect(toast.error).toHaveBeenCalledWith('Could not sign out. Please try again.')
  expect(refresh).not.toHaveBeenCalled()
})
