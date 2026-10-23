// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { apiFetch } from '@/api/client'
import type { MeResponse } from '@/api/types'
import { SessionProvider } from '@/providers/SessionProvider'
import { useSession } from '@/providers/session-context'
import { usePageCache } from '@/providers/page-cache-context'

vi.mock('@/api/client', () => ({ apiFetch: vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const container = document.createElement('div')
let root: ReturnType<typeof createRoot>
let current: ReturnType<typeof usePageCache>
let refresh: ReturnType<typeof useSession>['refresh']
function Probe() {
  current = usePageCache()
  refresh = useSession().refresh
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
  vi.mocked(apiFetch).mockResolvedValue(session)
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

  vi.mocked(apiFetch).mockRejectedValueOnce(new Error('unauthorized'))
  await act(async () => refresh())
  expect(current).toBeNull()
  expect(first.events.read('all')).toBeUndefined()
  await act(async () => refresh())
  expect(current).not.toBe(first)
  expect(current!.events.read('all')).toBeUndefined()

  const second = current!
  second.events.write('all', page, second.events.generation)
  vi.mocked(apiFetch).mockResolvedValue({ ...session, tenant: { id: 'tenant-2', name: 'Other' } })
  await act(async () => refresh())
  expect(current).not.toBe(second)
  expect(second.events.read('all')).toBeUndefined()
})
