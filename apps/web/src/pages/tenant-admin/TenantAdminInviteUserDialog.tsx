import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useInviteSubmit } from '@/components/invites/useInviteSubmit'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TenantAdminInviteUserDialogProps = {
  tenantId: string
  tenantName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvited: (result: { inviteUrl: string; expiresAt: string }) => void
}

export function TenantAdminInviteUserDialog({
  tenantId,
  tenantName,
  open,
  onOpenChange,
  onInvited,
}: TenantAdminInviteUserDialogProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  function resetForm() {
    setName('')
    setEmail('')
  }

  const {
    submitting,
    changeOpen: handleOpenChange,
    submit,
  } = useInviteSubmit({
    onOpenChange,
    onInvited,
    reset: resetForm,
  })

  function handleInviteUser(event: React.FormEvent<HTMLFormElement>) {
    void submit(event, {
      kind: 'tenant_user',
      tenant_id: tenantId,
      email: email.trim(),
      name: name.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription className="text-muted-strong">
            Creates an invite link for {tenantName}. Copy the link and send it manually.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleInviteUser}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-user-name">Full name (optional)</Label>
            <Input
              id="invite-user-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-user-email">Email</Label>
            <Input
              id="invite-user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <DialogFooter>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={submitting} className="sm-btn-split">
              <span className="sm-btn-split-label">
                {submitting ? 'Creating…' : 'Create invite'}
              </span>
              <span className="sm-btn-split-icon">
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
