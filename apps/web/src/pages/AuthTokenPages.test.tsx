// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logout, validateInvite, validatePasswordReset } from '@/api/client'
import type { MeResponse } from '@/api/types'
import { SessionContext } from '@/providers/session-context'
import AcceptInvite from '@/pages/AcceptInvite'
import ResetPassword from '@/pages/ResetPassword'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    logout: vi.fn(),
    validateInvite: vi.fn(),
    validatePasswordReset: vi.fn(),
  }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const session: MeResponse = {
  user: {
    id: 'signed-in-user',
    email: 'current@example.com',
    name: 'Current User',
    tenant_id: 'tenant-1',
    is_super_admin: false,
  },
  tenant: { id: 'tenant-1', name: 'Current Workspace' },
}

let container: HTMLDivElement
let root: Root
let refresh: () => Promise<void>

async function renderPage(path: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <SessionContext.Provider value={{ session, loading: false, refresh }}>
          <Routes>
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
        </SessionContext.Provider>
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  refresh = vi.fn().mockResolvedValue(undefined)
  vi.mocked(logout).mockReset().mockResolvedValue(undefined)
  vi.mocked(validateInvite)
    .mockReset()
    .mockResolvedValue({
      kind: 'tenant_user',
      email: 'invited@example.com',
      tenant_name: 'Invited Workspace',
      invited_name: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    })
  vi.mocked(validatePasswordReset)
    .mockReset()
    .mockResolvedValue({
      email: 'reset@example.com',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    })
})

afterEach(async () => {
  await act(async () => root.unmount())
  document.body.removeChild(container)
})

describe('signed-in token links', () => {
  it('validates an invite and asks the visitor to sign out', async () => {
    await renderPage('/accept-invite?token=invite-token')

    expect(validateInvite).toHaveBeenCalledWith('invite-token')
    expect(container.textContent).toContain('current@example.com')
    expect(container.textContent).toContain('invited@example.com')
    expect(container.textContent).toContain('Sign out to continue')
  })

  it('validates a password reset and signs out without leaving the link', async () => {
    await renderPage('/reset-password?token=reset-token')

    expect(validatePasswordReset).toHaveBeenCalledWith('reset-token')
    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Sign out to continue',
    )
    expect(button).toBeDefined()

    await act(async () => button?.click())
    expect(logout).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('keeps the signed-in prompt visible when logout fails', async () => {
    vi.mocked(logout).mockRejectedValue(new Error('network failure'))
    await renderPage('/accept-invite?token=invite-token')
    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Sign out to continue',
    )

    await act(async () => button?.click())
    expect(container.textContent).toContain('Could not sign out. Please try again.')
    expect(refresh).not.toHaveBeenCalled()
  })
})
