import { useNavigate } from 'react-router-dom'
import { useSession } from '@/providers/session-context'
import { useState } from 'react'
import { Link2, Search } from 'lucide-react'
import { ApiError, createMyWorkspace, listAdminTenants } from '@/api/client'
import type { AdminTenant } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConsolePage } from '@/components/console/ConsolePage'
import { PageBanner } from '@/components/console/PageBanner'
import { PAGE_SIZE } from '@/components/console/pagination-utils'
import { InviteUrlDialog } from '@/components/invites/InviteUrlDialog'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { AdminInviteTenantDialog } from '@/pages/admin/AdminInviteTenantDialog'
import { AdminTenantTable } from '@/pages/admin/AdminTenantTable'

export default function Admin() {
  const { session, refresh } = useSession()
  const navigate = useNavigate()
  const [workspaceName, setWorkspaceName] = useState('My workspace')
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteResult, setInviteResult] = useState<{
    inviteUrl: string
    expiresAt: string
  } | null>(null)
  const {
    data: tenants,
    hasMore,
    offset,
    setOffset,
    isInitial,
    isRefreshing,
    error,
    reload,
  } = usePaginatedList<AdminTenant>({
    pageSize: PAGE_SIZE,
    fetchPage: ({ limit, offset, signal }) =>
      listAdminTenants({ limit, offset, search: searchQuery.trim() || undefined }, { signal }),
    fallbackError: 'Failed to load tenants',
    queryKey: searchQuery.trim(),
  })

  return (
    <ConsolePage
      marker="Platform · Admin"
      title="Tenant management"
      description="Invite tenant owners and manage existing tenant accounts."
      actions={
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <Link2 className="size-4" strokeWidth={1.75} />
          Invite tenant
        </Button>
      }
      toolbar={
        <div className="relative w-full">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-strong"
            aria-hidden="true"
          />
          <Input
            placeholder="Search tenants by name or ID…"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setOffset(0)
            }}
            className="min-h-0 w-full pl-9"
          />
        </div>
      }
    >
      {!session?.tenant && (
        <form
          className="mb-6 flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            setCreatingWorkspace(true)
            setWorkspaceError(null)
            try {
              await createMyWorkspace(workspaceName)
              await refresh()
              navigate('/dashboard')
            } catch (err) {
              setWorkspaceError(
                err instanceof ApiError ? err.message : 'Could not create workspace. Try again.',
              )
            } finally {
              setCreatingWorkspace(false)
            }
          }}
        >
          <h2 className="text-lg font-semibold">Create your workspace</h2>
          <p className="text-sm text-muted-strong">
            A super-admin needs a workspace before sending events.
          </p>
          <label htmlFor="workspace-name">Workspace name</label>
          <Input
            id="workspace-name"
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            maxLength={200}
            required
          />
          {workspaceError && (
            <PageBanner
              variant="error"
              title="Workspace setup failed"
              description={workspaceError}
            />
          )}
          <Button type="submit" disabled={creatingWorkspace}>
            {creatingWorkspace ? 'Creating…' : 'Create my workspace'}
          </Button>
        </form>
      )}
      {error ? (
        <PageBanner variant="error" title="Could not load tenants" description={error} />
      ) : null}

      <AdminTenantTable
        tenants={tenants}
        hasMore={hasMore}
        offset={offset}
        loading={isInitial || isRefreshing}
        onOffsetChange={setOffset}
        onRefresh={() => void reload()}
        searchQuery={searchQuery}
      />

      <InviteUrlDialog
        open={inviteResult !== null}
        inviteUrl={inviteResult?.inviteUrl ?? null}
        expiresAt={inviteResult?.expiresAt ?? null}
        onOpenChange={(open) => {
          if (!open) setInviteResult(null)
        }}
      />

      <AdminInviteTenantDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={setInviteResult}
      />
    </ConsolePage>
  )
}
