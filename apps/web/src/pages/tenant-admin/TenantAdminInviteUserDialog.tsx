import { useReducer, useState } from 'react'
import { ArrowRight, Copy } from 'lucide-react'
import { ApiError, createAdminInvite } from '@/api/client'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import {
  CatalogDialog,
  CatalogDialogContent,
  CatalogDialogDescription,
  CatalogDialogFooter,
  CatalogDialogHeader,
  CatalogDialogTitle,
} from '@/components/catalog/CatalogDialog'
import { CatalogInput } from '@/components/catalog/CatalogInput'
import { PageBanner } from '@/components/console/PageBanner'
import { Label } from '@/components/ui/label'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'

type InviteUserFormState = {
  name: string
  email: string
  submitting: boolean
}

type InviteUserFormAction =
  | { type: 'set_field'; field: keyof Omit<InviteUserFormState, 'submitting'>; value: string }
  | { type: 'submit_start' }
  | { type: 'submit_end' }
  | { type: 'reset' }

const initialInviteUserFormState: InviteUserFormState = {
  name: '',
  email: '',
  submitting: false,
}

function inviteUserFormReducer(
  state: InviteUserFormState,
  action: InviteUserFormAction,
): InviteUserFormState {
  switch (action.type) {
    case 'set_field':
      return { ...state, [action.field]: action.value }
    case 'submit_start':
      return { ...state, submitting: true }
    case 'submit_end':
      return { ...state, submitting: false }
    case 'reset':
      return initialInviteUserFormState
  }
}

type TenantAdminInviteUserDialogProps = {
  tenantId: string
  tenantName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TenantAdminInviteUserDialog({
  tenantId,
  tenantName,
  open,
  onOpenChange,
}: TenantAdminInviteUserDialogProps) {
  const [form, dispatch] = useReducer(inviteUserFormReducer, initialInviteUserFormState)
  const [inviteResult, setInviteResult] = useState<{ inviteUrl: string; expiresAt: string } | null>(null)

  async function handleInviteUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatch({ type: 'submit_start' })

    try {
      const result = await createAdminInvite({
        kind: 'tenant_user',
        tenant_id: tenantId,
        email: form.email.trim(),
        name: form.name.trim() || undefined,
      })
      setInviteResult({ inviteUrl: result.invite_url, expiresAt: result.expires_at })
      toast.success('Invite created')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create invite')
    } finally {
      dispatch({ type: 'submit_end' })
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !form.submitting) {
      dispatch({ type: 'reset' })
      setInviteResult(null)
    }
    onOpenChange(nextOpen)
  }

  async function copyInviteUrl() {
    if (!inviteResult) return
    await navigator.clipboard.writeText(inviteResult.inviteUrl)
    toast.success('Invite link copied')
  }

  return (
    <CatalogDialog open={open} onOpenChange={handleOpenChange}>
      <CatalogDialogContent className="sm:max-w-lg">
        {!inviteResult ? (
          <>
            <CatalogDialogHeader>
              <CatalogDialogTitle>Invite user</CatalogDialogTitle>
              <CatalogDialogDescription className="text-muted-strong">
                Creates an invite link for {tenantName}. Copy the link and send it manually.
              </CatalogDialogDescription>
            </CatalogDialogHeader>

            <form className="flex flex-col gap-4" onSubmit={handleInviteUser}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-user-name">Full name (optional)</Label>
                <CatalogInput
                  id="invite-user-name"
                  autoFocus
                  value={form.name}
                  onChange={(event) =>
                    dispatch({ type: 'set_field', field: 'name', value: event.target.value })
                  }
                  disabled={form.submitting}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-user-email">Email</Label>
                <CatalogInput
                  id="invite-user-email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    dispatch({ type: 'set_field', field: 'email', value: event.target.value })
                  }
                  required
                  disabled={form.submitting}
                />
              </div>

              <CatalogDialogFooter>
                <CatalogButton
                  type="button"
                  variant="secondary"
                  onClick={() => handleOpenChange(false)}
                  disabled={form.submitting}
                  className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
                >
                  Cancel
                </CatalogButton>
                <CatalogButton type="submit" disabled={form.submitting} className="sm-btn-split h-[2.125rem] min-h-0">
                  <span className="sm-btn-split-label text-[0.8125rem]">
                    {form.submitting ? 'Creating…' : 'Create invite'}
                  </span>
                  <span className="sm-btn-split-icon" style={{ width: '2.125rem', minWidth: '2.125rem' }}>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                </CatalogButton>
              </CatalogDialogFooter>
            </form>
          </>
        ) : (
          <>
            <CatalogDialogHeader>
              <CatalogDialogTitle>Invite link</CatalogDialogTitle>
              <CatalogDialogDescription className="text-muted-foreground">
                Copy this link now and send it to the invitee. The server cannot show it again
                after you close this dialog.
              </CatalogDialogDescription>
            </CatalogDialogHeader>

            <div className="flex flex-col gap-4">
              <PageBanner
                variant="info"
                title="Shown once"
                description={
                  inviteResult.expiresAt
                    ? `Link expires ${formatDateTime(inviteResult.expiresAt)}. Treat it like a password.`
                    : 'Treat this link like a password.'
                }
              />

              <div className="flex items-center gap-2 border border-border bg-muted/30 p-3">
                <code className="flex-1 overflow-x-auto font-mono text-xs break-all text-foreground">
                  {inviteResult.inviteUrl}
                </code>
                <CatalogButton
                  type="button"
                  variant="secondary"
                  className="shrink-0 px-2.5"
                  onClick={copyInviteUrl}
                  aria-label="Copy invite link"
                >
                  <Copy className="size-4" />
                </CatalogButton>
              </div>
            </div>

            <CatalogDialogFooter>
              <CatalogButton type="button" onClick={() => handleOpenChange(false)}>
                Done
              </CatalogButton>
            </CatalogDialogFooter>
          </>
        )}
      </CatalogDialogContent>
    </CatalogDialog>
  )
}
