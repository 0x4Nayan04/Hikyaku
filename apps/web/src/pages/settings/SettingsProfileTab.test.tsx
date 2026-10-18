// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { changePassword } from '@/api/client'
import type { MeResponse } from '@/api/types'
import { SessionContext } from '@/providers/session-context'
import { SettingsProfileTab } from '@/pages/settings/SettingsProfileTab'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    changePassword: vi.fn(),
  }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const session: MeResponse = {
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
let refresh: ReturnType<typeof vi.fn<() => Promise<void>>>
let loginLocation: ReturnType<typeof useLocation> | null

function LoginProbe() {
  loginLocation = useLocation()
  return <div>Login page</div>
}

function setControlledInput(input: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(input) as HTMLInputElement
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  const previous = input.value
  descriptor?.set?.call(input, value)
  // React controlled inputs ignore identical consecutive native values unless the tracker is reset.
  const tracker = (input as HTMLInputElement & { _valueTracker?: { setValue: (v: string) => void } })
    ._valueTracker
  tracker?.setValue(previous)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function renderProfile() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/settings?tab=profile']}>
        <SessionContext.Provider value={{ session, loading: false, refresh }}>
          <Routes>
            <Route path="/settings" element={<SettingsProfileTab />} />
            <Route path="/login" element={<LoginProbe />} />
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
  loginLocation = null
  refresh = vi.fn().mockResolvedValue(undefined)
  vi.mocked(changePassword).mockReset().mockResolvedValue(undefined)
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  document.body.removeChild(container)
})

describe('SettingsProfileTab password change', () => {
  it('navigates to login with banner state and does not refresh under the protected tree', async () => {
    await renderProfile()

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
      expect(changePassword).toHaveBeenCalledWith({
        current_password: 'old-password-12',
        new_password: 'new-password-12',
      })
    })

    expect(loginLocation?.pathname).toBe('/login')
    expect(loginLocation?.state).toEqual({
      banner: 'password_updated',
      message: 'Password updated. Sign in again with your new password.',
      from: { pathname: '/settings', search: '?tab=profile' },
    })
    expect(refresh).not.toHaveBeenCalled()
  })
})
