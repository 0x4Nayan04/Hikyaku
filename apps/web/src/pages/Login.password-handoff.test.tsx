// @vitest-environment jsdom
import { act, useCallback, useMemo, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { changePassword } from '@/api/client'
import type { MeResponse } from '@/api/types'
import { RequireSession } from '@/components/layout/RequireSession'
import Login from '@/pages/Login'
import { SettingsProfileTab } from '@/pages/settings/SettingsProfileTab'
import { SessionContext } from '@/providers/session-context'

vi.mock('@/lib/bootstrap-status', () => ({
  loadBootstrapStatus: vi.fn().mockResolvedValue(false),
  readBootstrapStatusCache: vi.fn().mockReturnValue(false),
}))

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    changePassword: vi.fn(),
  }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const warmSession: MeResponse = {
  user: {
    id: 'user-1',
    email: 'owner@example.com',
    name: 'Owner',
    tenant_id: 'tenant-1',
    is_super_admin: false,
  },
  tenant: { id: 'tenant-1', name: 'Acme' },
}

let container: HTMLDivElement
let root: Root
let locationProbe: ReturnType<typeof useLocation> | null
let refreshCalls: number

function LocationProbe({ children }: { children: ReactNode }) {
  locationProbe = useLocation()
  return children
}

function StatefulSession({
  children,
  initialSession,
}: {
  children: ReactNode
  initialSession: MeResponse | null
}) {
  const [session, setSession] = useState<MeResponse | null>(initialSession)
  const [loading, setLoading] = useState(false)
  const refresh = useCallback(async () => {
    refreshCalls += 1
    // Mimic post-password-change /me: cookie invalidated → null session.
    setSession(null)
    setLoading(false)
  }, [])
  const value = useMemo(() => ({ session, loading, refresh }), [session, loading, refresh])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

function setControlledInput(input: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(input) as HTMLInputElement
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  const previous = input.value
  descriptor?.set?.call(input, value)
  const tracker = (input as HTMLInputElement & { _valueTracker?: { setValue: (v: string) => void } })
    ._valueTracker
  tracker?.setValue(previous)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function renderLogin(state: unknown, session: MeResponse | null = warmSession) {
  const refresh = vi.fn().mockResolvedValue(undefined)
  await act(async () => {
    root.render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/login',
            state,
          },
        ]}
      >
        <SessionContext.Provider value={{ session, loading: false, refresh }}>
          <LocationProbe>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/settings" element={<div>Settings</div>} />
              <Route path="/dashboard" element={<div>Dashboard</div>} />
            </Routes>
          </LocationProbe>
        </SessionContext.Provider>
      </MemoryRouter>,
    )
  })
  return refresh
}

async function renderPasswordChangeLifecycle() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/settings?tab=profile']}>
        <StatefulSession initialSession={warmSession}>
          <LocationProbe>
            <Routes>
              <Route element={<RequireSession />}>
                <Route path="/settings" element={<SettingsProfileTab />} />
              </Route>
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<div>Dashboard</div>} />
            </Routes>
          </LocationProbe>
        </StatefulSession>
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  locationProbe = null
  refreshCalls = 0
  vi.mocked(changePassword).mockReset().mockResolvedValue(undefined)
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  document.body.removeChild(container)
})

describe('Login password-updated handoff', () => {
  it('keeps the success banner and stays on login while a warm session remains', async () => {
    const refresh = await renderLogin({
      banner: 'password_updated',
      message: 'Password updated. Sign in again with your new password.',
      from: { pathname: '/settings', search: '?tab=profile' },
    })

    expect(locationProbe?.pathname).toBe('/login')
    expect(container.textContent).toContain('Password updated')
    expect(container.textContent).toContain('Sign in again with your new password.')
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('survives session invalidation after navigation commits under RequireSession', async () => {
    await renderPasswordChangeLifecycle()

    await act(async () => {
      setControlledInput(
        container.querySelector('#current-password') as HTMLInputElement,
        'old-password-12',
      )
      setControlledInput(
        container.querySelector('#new-password') as HTMLInputElement,
        'new-password-12',
      )
      setControlledInput(
        container.querySelector('#confirm-password') as HTMLInputElement,
        'new-password-12',
      )
    })

    const form = container.querySelector('#security-form') as HTMLFormElement
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    await vi.waitFor(() => {
      expect(changePassword).toHaveBeenCalledOnce()
      expect(locationProbe?.pathname).toBe('/login')
    })

    await vi.waitFor(() => {
      expect(refreshCalls).toBe(1)
    })

    expect(locationProbe?.pathname).toBe('/login')
    expect(locationProbe?.state).toMatchObject({
      banner: 'password_updated',
      message: 'Password updated. Sign in again with your new password.',
      from: { pathname: '/settings', search: '?tab=profile' },
    })
    expect(container.textContent).toContain('Password updated')
    expect(container.textContent).toContain('Sign in again with your new password.')
    expect(container.textContent).not.toContain('Dashboard')
  })
})
