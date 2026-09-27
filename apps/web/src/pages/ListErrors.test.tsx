// @vitest-environment jsdom
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAdminTenant,
  listAdminTenants,
  listApiKeys,
  listDeliveries,
  listEndpoints,
  listEvents,
  listTenantUsers,
} from '@/api/client'
import { SessionContext } from '@/providers/session-context'
import Admin from '@/pages/Admin'
import Deliveries from '@/pages/Deliveries'
import Endpoints from '@/pages/Endpoints'
import Events from '@/pages/Events'
import Settings from '@/pages/Settings'
import TenantAdmin from '@/pages/TenantAdmin'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  getAdminTenant: vi.fn(),
  listAdminTenants: vi.fn(),
  listApiKeys: vi.fn(),
  listDeliveries: vi.fn(),
  listEndpoints: vi.fn(),
  listEvents: vi.fn(),
  listTenantUsers: vi.fn(),
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let container: HTMLDivElement
let root: Root
const loaders = [
  listAdminTenants,
  listApiKeys,
  listDeliveries,
  listEndpoints,
  listEvents,
  listTenantUsers,
]
const cases: Array<[string, ReactElement, string, string]> = [
  ['/events', <Events />, 'Could not load events', 'No events yet'],
  ['/deliveries', <Deliveries />, 'Could not load deliveries', 'No deliveries yet'],
  ['/endpoints', <Endpoints />, 'Could not load endpoints', 'No endpoints yet'],
  ['/admin', <Admin />, 'Could not load tenants', 'No tenants yet'],
  ['/settings?tab=api-keys', <Settings />, 'Could not load API keys', 'No API keys yet'],
  ['/admin/tenants/tenant-1', <TenantAdmin />, 'Could not load tenant users', 'No users yet'],
]

beforeEach(() => {
  vi.resetAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.mocked(getAdminTenant).mockResolvedValue({
    id: 'tenant-1',
    name: 'Workspace',
    created_at: '2026-09-27T00:00:00Z',
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderPage(path: string, element: ReactElement) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <SessionContext.Provider
          value={{
            session: {
              user: {
                id: 'user-1',
                email: 'user@example.com',
                name: 'User',
                tenant_id: 'tenant-1',
                is_super_admin: true,
              },
              tenant: { id: 'tenant-1', name: 'Workspace' },
            },
            loading: false,
            refresh: vi.fn(),
          }}
        >
          <Routes>
            <Route
              path={path.startsWith('/admin/tenants/') ? '/admin/tenants/:id' : '*'}
              element={element}
            />
          </Routes>
        </SessionContext.Provider>
      </MemoryRouter>,
    )
  })
}

describe('List empty states', () => {
  it.each(cases)(
    '%s shows errors without empty-workspace copy',
    async (path, element, error, empty) => {
      for (const loader of loaders) vi.mocked(loader).mockRejectedValue(new Error('unavailable'))
      await renderPage(path, element)
      expect(container.textContent).toContain(error)
      expect(container.textContent).not.toContain(empty)
    },
  )

  it.each(cases)(
    '%s still shows a successful empty result',
    async (path, element, error, empty) => {
      for (const loader of loaders)
        vi.mocked(loader).mockResolvedValue({ data: [], has_more: false, limit: 25, offset: 0 })
      await renderPage(path, element)
      expect(container.textContent).not.toContain(error)
      expect(container.textContent).toContain(empty)
    },
  )
})
