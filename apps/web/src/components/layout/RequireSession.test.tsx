// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RequireSession } from '@/components/layout/RequireSession'
import { SessionContext } from '@/providers/session-context'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
let loginLocation: ReturnType<typeof useLocation> | null

function LoginProbe() {
  loginLocation = useLocation()
  return <div>Login</div>
}

async function renderGate(state: unknown) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[{ pathname: '/settings', search: '?tab=profile', state }]}>
        <SessionContext.Provider value={{ session: null, loading: false, refresh: async () => undefined }}>
          <Routes>
            <Route element={<RequireSession />}>
              <Route path="/settings" element={<div>Protected</div>} />
            </Route>
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
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  document.body.removeChild(container)
})

describe('RequireSession', () => {
  it('redirects unauthenticated visitors to login with the current location as from', async () => {
    await renderGate(null)

    expect(loginLocation?.pathname).toBe('/login')
    expect(loginLocation?.state).toMatchObject({
      from: expect.objectContaining({ pathname: '/settings', search: '?tab=profile' }),
    })
    expect(loginLocation?.state).not.toHaveProperty('banner')
  })
})
