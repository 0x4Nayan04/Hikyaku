import { useReducer } from 'react'
import { ArrowRight } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/toast'

type InviteFormState = {
  tenantName: string
  ownerName: string
  ownerEmail: string
  submitting: boolean
}

type InviteFormAction =
  | { type: 'set_field'; field: keyof Omit<InviteFormState, 'submitting'>; value: string }
  | { type: 'submit_start' }
  | { type: 'submit_end' }
  | { type: 'reset' }

const initialInviteFormState: InviteFormState = {
  tenantName: '',
  ownerName: '',
  ownerEmail: '',
  submitting: false,
}

function inviteFormReducer(state: InviteFormState, action: InviteFormAction): InviteFormState {
  switch (action.type) {
    case 'set_field':
      return { ...state, [action.field]: action.value }
    case 'submit_start':
      return { ...state, submitting: true }
    case 'submit_end':
      return { ...state, submitting: false }
    case 'reset':
      return initialInviteFormState
  }
}

type AdminInviteTenantDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvited: (result: { inviteUrl: string; expiresAt: string }) => void
}

export function AdminInviteTenantDialog({
  open,
  onOpenChange,
  onInvited,
}: AdminInviteTenantDialogProps) {
  const [form, dispatch] = useReducer(inviteFormReducer, initialInviteFormState)

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatch({ type: 'submit_start' })

    try {
      const result = await createAdminInvite({
        kind: 'tenant_owner',
        tenant_name: form.tenantName.trim(),
        owner_email: form.ownerEmail.trim(),
        owner_name: form.ownerName.trim() || undefined,
      })
      dispatch({ type: 'reset' })
      onOpenChange(false)
      onInvited({ inviteUrl: result.invite_url, expiresAt: result.expires_at })
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
    }
    onOpenChange(nextOpen)
  }

  return (
    <CatalogDialog open={open} onOpenChange={handleOpenChange}>
      <CatalogDialogContent className="sm:max-w-lg">
        <CatalogDialogHeader>
          <CatalogDialogTitle>Invite tenant</CatalogDialogTitle>
          <CatalogDialogDescription className="text-muted-foreground">
            Creates an invite link for a new tenant owner. Copy the link and send it manually.
          </CatalogDialogDescription>
        </CatalogDialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleInvite}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-tenant-name">Tenant name</Label>
            <CatalogInput
              id="invite-tenant-name"
              value={form.tenantName}
              onChange={(event) =>
                dispatch({ type: 'set_field', field: 'tenantName', value: event.target.value })
              }
              placeholder="Acme Corp"
              required
              disabled={form.submitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-owner-name">Owner name (optional)</Label>
              <CatalogInput
                id="invite-owner-name"
                value={form.ownerName}
                onChange={(event) =>
                  dispatch({ type: 'set_field', field: 'ownerName', value: event.target.value })
                }
                placeholder="Acme Owner"
                disabled={form.submitting}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-owner-email">Owner email</Label>
              <CatalogInput
                id="invite-owner-email"
                type="email"
                value={form.ownerEmail}
                onChange={(event) =>
                  dispatch({ type: 'set_field', field: 'ownerEmail', value: event.target.value })
                }
                placeholder="owner@acme.com"
                required
                disabled={form.submitting}
              />
            </div>
          </div>

            <CatalogDialogFooter>
              <CatalogButton size="sm"
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                disabled={form.submitting}
              >
                Cancel
              </CatalogButton>
              <CatalogButton size="sm" type="submit" disabled={form.submitting} className="sm-btn-split">
                <span className="sm-btn-split-label">
                  {form.submitting ? 'Creating…' : 'Create invite'}
                </span>
                <span className="sm-btn-split-icon">
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </CatalogButton>
            </CatalogDialogFooter>
        </form>
      </CatalogDialogContent>
    </CatalogDialog>
  )
}
