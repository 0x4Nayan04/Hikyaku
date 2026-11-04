// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MeResponse } from '@/api/types'
import { SessionContext } from '@/providers/session-context'
import { RequireSuperAdmin } from './RequireSuperAdmin'
import { RequireTenantUser } from './RequireTenantUser'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root: Root
let container: HTMLDivElement
beforeEach(() => {
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
})

function session(admin: boolean, tenant: boolean): MeResponse {
  return {
    user: {
      id: 'user',
      email: 'user@example.com',
      name: 'User',
      is_super_admin: admin,
      tenant_id: tenant ? 'tenant' : null,
    },
    tenant: tenant ? { id: 'tenant', name: 'Workspace' } : null,
  }
}

async function renderGate(kind: 'admin' | 'tenant', value: MeResponse) {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={['/protected']}>
        <SessionContext.Provider
          value={{ session: value, loading: false, refresh: async () => undefined }}
        >
          <Routes>
            <Route element={kind === 'admin' ? <RequireSuperAdmin /> : <RequireTenantUser />}>
              <Route path="/protected" element={<p>Allowed</p>} />
            </Route>
            <Route path="/dashboard" element={<p>Dashboard redirect</p>} />
            <Route path="/admin" element={<p>Admin redirect</p>} />
            <Route path="/login" element={<p>Login redirect</p>} />
          </Routes>
        </SessionContext.Provider>
      </MemoryRouter>,
    ),
  )
}

describe('role boundaries', () => {
  it.each([false, true])(
    'keeps admin access for super-admins with workspace=%s',
    async (tenant) => {
      await renderGate('admin', session(true, tenant))
      expect(container.textContent).toBe('Allowed')
    },
  )
  it('redirects a tenant operator away from platform administration', async () => {
    await renderGate('admin', session(false, true))
    expect(container.textContent).toBe('Dashboard redirect')
  })
  it('redirects a platform-only admin before tenant API requests can mount', async () => {
    await renderGate('tenant', session(true, false))
    expect(container.textContent).toBe('Admin redirect')
  })
  it.each([false, true])(
    'allows a workspace member with admin=%s into tenant routes',
    async (admin) => {
      await renderGate('tenant', session(admin, true))
      expect(container.textContent).toBe('Allowed')
    },
  )
})
