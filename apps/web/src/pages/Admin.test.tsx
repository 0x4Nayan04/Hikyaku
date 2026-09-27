import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listAdminTenants } from '@/api/client'
import type { MeResponse, Paginated } from '@/api/types'
import { SessionContext } from '@/providers/session-context'
import Admin from '@/pages/Admin'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    listAdminTenants: vi.fn(),
  }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const emptyPage: Paginated<never> = { data: [], has_more: false, limit: 25, offset: 0 }

const workspaceLessAdmin: MeResponse = {
  user: {
    id: 'user-admin',
    email: 'admin@example.com',
    name: 'Admin',
    tenant_id: null,
    is_super_admin: true,
  },
  tenant: null,
}

const workspaceAdmin: MeResponse = {
  ...workspaceLessAdmin,
  user: { ...workspaceLessAdmin.user, tenant_id: 'tenant-admin' },
  tenant: { id: 'tenant-admin', name: 'Agenda Admin Workspace' },
}

let container: HTMLDivElement
let root: Root

async function renderAdmin(session: MeResponse) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <SessionContext.Provider value={{ session, loading: false, refresh: vi.fn() }}>
          <Admin />
        </SessionContext.Provider>
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.mocked(listAdminTenants).mockReset()
  vi.mocked(listAdminTenants).mockResolvedValue(emptyPage)
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  document.body.removeChild(container)
})

describe('Admin workspace form', () => {
  it('explains that a workspace-less super-admin must create a workspace', async () => {
    await renderAdmin(workspaceLessAdmin)

    expect(container.textContent).toContain('Create your workspace')
    expect(container.textContent).toContain(
      'A super-admin needs a workspace before sending events.',
    )
    expect(container.textContent).toContain('Create my workspace')
    expect(container.textContent).not.toContain('Send your first webhook')
  })

  it('hides the workspace form when the super-admin already has one', async () => {
    await renderAdmin(workspaceAdmin)

    expect(container.textContent).not.toContain('Create your workspace')
    expect(container.textContent).not.toContain('Create my workspace')
    expect(container.textContent).toContain('Tenant management')
  })
})
