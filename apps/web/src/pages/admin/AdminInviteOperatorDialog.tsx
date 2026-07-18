import { useReducer } from 'react'
import { ArrowRight } from 'lucide-react'
import { ApiError, inviteOperator } from '@/api/client'
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
  name: string
  email: string
  submitting: boolean
}

type InviteFormAction =
  | { type: 'set_field'; field: 'name' | 'email'; value: string }
  | { type: 'submit_start' }
  | { type: 'submit_end' }
  | { type: 'reset' }

const initialInviteFormState: InviteFormState = {
  name: '',
  email: '',
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
    default:
      action satisfies never
      return state
  }
}

type AdminInviteOperatorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvited: (result: { inviteUrl: string; expiresAt: string }) => void
}

export function AdminInviteOperatorDialog({
  open,
  onOpenChange,
  onInvited,
}: AdminInviteOperatorDialogProps) {
  const [form, dispatch] = useReducer(inviteFormReducer, initialInviteFormState)

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatch({ type: 'submit_start' })

    try {
      const result = await inviteOperator({
        email: form.email.trim(),
        name: form.name.trim() || undefined,
      })
      dispatch({ type: 'reset' })
      onOpenChange(false)
      onInvited({ inviteUrl: result.invite_url, expiresAt: result.expires_at })
      toast.success('Admin invite created')
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
          <CatalogDialogTitle>Invite admin</CatalogDialogTitle>
          <CatalogDialogDescription className="text-muted-foreground">
            Creates an invite link for a new platform admin. Copy the link and send it manually.
          </CatalogDialogDescription>
        </CatalogDialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleInvite}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-operator-name">Name (optional)</Label>
            <CatalogInput
              id="invite-operator-name"
              value={form.name}
              onChange={(event) =>
                dispatch({ type: 'set_field', field: 'name', value: event.target.value })
              }
              placeholder="Alex Admin"
              disabled={form.submitting}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-operator-email">Email</Label>
            <CatalogInput
              id="invite-operator-email"
              type="email"
              value={form.email}
              onChange={(event) =>
                dispatch({ type: 'set_field', field: 'email', value: event.target.value })
              }
              placeholder="admin@example.com"
              required
              disabled={form.submitting}
            />
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
            <CatalogButton size="sm"
              type="submit"
              disabled={form.submitting} className="sm-btn-split"
            >
              <span className="sm-btn-split-label">
                {form.submitting ? 'Creating…' : 'Create invite'}
              </span>
              <span className="sm-btn-split-icon"
              >
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </CatalogButton>
          </CatalogDialogFooter>
        </form>
      </CatalogDialogContent>
    </CatalogDialog>
  )
}
