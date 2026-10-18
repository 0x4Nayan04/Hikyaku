// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listAdminTenants } from '@/api/client'
import type { AdminTenant, MeResponse, Paginated } from '@/api/types'
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

const tenant: AdminTenant = {
  id: 'tenant-1',
  name: 'Acme',
  created_at: '2026-09-27T00:00:00Z',
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

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
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
  vi.useRealTimers()
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

describe('Admin search debounce', () => {
  it('coalesces keystroke bursts into one committed search request', async () => {
    vi.useFakeTimers()
    vi.mocked(listAdminTenants).mockResolvedValue(emptyPage)
    await renderAdmin(workspaceAdmin)
    expect(listAdminTenants).toHaveBeenCalledTimes(1)
    expect(listAdminTenants).toHaveBeenLastCalledWith(
      { limit: 25, offset: 0, search: undefined },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )

    const input = container.querySelector('input[placeholder="Search tenants by name or ID…"]') as HTMLInputElement
    await act(async () => {
      setInputValue(input, 'a')
      setInputValue(input, 'ac')
      setInputValue(input, 'acm')
      setInputValue(input, 'acme')
    })
    await advance(299)
    expect(listAdminTenants).toHaveBeenCalledTimes(1)

    await advance(1)
    expect(listAdminTenants).toHaveBeenCalledTimes(2)
    expect(listAdminTenants).toHaveBeenLastCalledWith(
      { limit: 25, offset: 0, search: 'acme' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('resets pagination when the committed search query changes', async () => {
    vi.useFakeTimers()
    vi.mocked(listAdminTenants)
      .mockResolvedValueOnce({
        data: [tenant],
        has_more: true,
        limit: 25,
        offset: 0,
      })
      .mockResolvedValueOnce({
        data: [{ ...tenant, id: 'tenant-2', name: 'Acme Two' }],
        has_more: false,
        limit: 25,
        offset: 25,
      })
      .mockResolvedValue(emptyPage)

    await renderAdmin(workspaceAdmin)
    expect(listAdminTenants).toHaveBeenCalledTimes(1)

    const next = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Next',
    )
    expect(next).toBeDefined()
    await act(async () => {
      next?.click()
    })
    expect(listAdminTenants).toHaveBeenLastCalledWith(
      { limit: 25, offset: 25, search: undefined },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )

    const input = container.querySelector('input[placeholder="Search tenants by name or ID…"]') as HTMLInputElement
    await act(async () => {
      setInputValue(input, 'acme')
    })
    await advance(300)
    expect(listAdminTenants).toHaveBeenLastCalledWith(
      { limit: 25, offset: 0, search: 'acme' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })
})
