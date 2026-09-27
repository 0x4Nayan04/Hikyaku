// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { logout } from '@/api/client'
import type { MeResponse } from '@/api/types'
import { AppTopBar } from '@/components/app/AppTopBar'
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

let container: HTMLDivElement
let root: Root
let refresh: () => Promise<void>

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  refresh = vi.fn().mockResolvedValue(undefined)
  vi.mocked(logout).mockReset()
  vi.mocked(toast.error).mockReset()

  await act(async () => {
    root.render(
      <MemoryRouter>
        <SessionContext.Provider value={{ session, loading: false, refresh }}>
          <AppTopBar session={session} loading={false} isSuperAdmin={false} />
        </SessionContext.Provider>
      </MemoryRouter>,
    )
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  document.body.removeChild(container)
})

it('stays in the app when logout fails', async () => {
  vi.mocked(logout).mockRejectedValue(new Error('network failure'))
  const accountButton = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Open account menu"]',
  )
  await act(async () => accountButton?.click())
  const logoutButton = Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Log out'),
  )

  await act(async () => logoutButton?.click())

  expect(toast.error).toHaveBeenCalledWith('Could not sign out. Please try again.')
  expect(refresh).not.toHaveBeenCalled()
})
