// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError, getMe } from '@/api/client'
import type { MeResponse } from '@/api/types'
import { SessionProvider } from '@/providers/SessionProvider'
import { useSession } from '@/providers/session-context'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RequireSession } from '@/components/layout/RequireSession'
import { usePageCache } from '@/providers/page-cache-context'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  getMe: vi.fn(),
}))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const container = document.createElement('div')
let root: ReturnType<typeof createRoot>
let current: ReturnType<typeof usePageCache>
let refresh: ReturnType<typeof useSession>['refresh']
let sessionState: ReturnType<typeof useSession>
function Probe() {
  current = usePageCache()
  sessionState = useSession()
  refresh = sessionState.refresh
  return null
}
afterEach(async () => {
  await act(async () => root.unmount())
  vi.resetAllMocks()
})

it('preserves results on session refresh but clears them on logout and creates a new store on login', async () => {
  const session: MeResponse = {
    user: { id: 'user-1', email: 'test@example.com', name: 'Test', is_super_admin: false },
    tenant: { id: 'tenant-1', name: 'Workspace' },
  }
  vi.mocked(getMe).mockResolvedValue(session)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <StrictMode>
        <SessionProvider>
          <Probe />
        </SessionProvider>
      </StrictMode>,
    ),
  )
  const first = current!
  const page = { data: [], has_more: false, limit: 25, offset: 0 }
  first.events.write('all', page, first.events.generation)
  await act(async () => refresh())
  expect(current).toBe(first)
  expect(current!.events.read('all')).toEqual(page)

  vi.mocked(getMe).mockRejectedValueOnce(new ApiError(401, 'unauthorized', 'Sign in again'))
  await act(async () => refresh())
  expect(current).toBeNull()
  expect(first.events.read('all')).toBeUndefined()
  await act(async () => refresh())
  expect(current).not.toBe(first)
  expect(current!.events.read('all')).toBeUndefined()

  const second = current!
  second.events.write('all', page, second.events.generation)
  vi.mocked(getMe).mockResolvedValue({ ...session, tenant: { id: 'tenant-2', name: 'Other' } })
  await act(async () => refresh())
  expect(current).not.toBe(second)
  expect(second.events.read('all')).toBeUndefined()
})

it.each([new Error('offline'), new ApiError(503, 'unavailable', 'Service unavailable')])(
  'keeps an authenticated session and its cache during a session-probe outage',
  async (failure) => {
    const session: MeResponse = {
      user: { id: 'user-1', email: 'test@example.com', name: 'Test', is_super_admin: false },
      tenant: { id: 'tenant-1', name: 'Workspace' },
    }
    vi.mocked(getMe).mockResolvedValue(session)
    root = createRoot(container)
    await act(async () =>
      root.render(
        <SessionProvider>
          <Probe />
        </SessionProvider>,
      ),
    )
    const cache = current!
    vi.mocked(getMe).mockRejectedValueOnce(failure)
    await act(async () => refresh())
    expect(sessionState.session).toEqual(session)
    expect(sessionState.error).toBeTruthy()
    expect(current).toBe(cache)
    await act(async () => refresh())
    expect(sessionState.error).toBeNull()
  },
)

it('keeps a pending session retry guarded instead of flashing a logged-out redirect', async () => {
  vi.mocked(getMe).mockRejectedValueOnce(new Error('offline'))
  root = createRoot(container)
  await act(async () =>
    root.render(
      <SessionProvider>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route element={<RequireSession />}>
              <Route path="/protected" element={<p>Protected content</p>} />
            </Route>
            <Route path="/login" element={<p>Login redirect</p>} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>,
    ),
  )
  expect(container.textContent).toContain('Could not load your session')
  let resolve!: (session: MeResponse) => void
  vi.mocked(getMe).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  await act(async () => container.querySelector('button')!.click())
  expect(container.textContent).not.toContain('Login redirect')
  expect(container.textContent).not.toContain('Protected content')
  expect(container.textContent).not.toContain('Could not load your session')
  await act(async () =>
    resolve({
      user: { id: 'user', email: 'user@example.com', name: 'User', is_super_admin: false },
      tenant: { id: 'tenant', name: 'Workspace' },
    }),
  )
  expect(container.textContent).toBe('Protected content')
})
