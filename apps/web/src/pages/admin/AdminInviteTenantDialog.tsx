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
  const [tenantName, setTenantName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')

  function resetForm() {
    setTenantName('')
    setOwnerName('')
    setOwnerEmail('')
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

  function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    void submit(event, {
      kind: 'tenant_owner',
      tenant_name: tenantName.trim(),
      owner_email: ownerEmail.trim(),
      owner_name: ownerName.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite tenant</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Creates an invite link for a new tenant owner. Copy the link and send it manually.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleInvite}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-tenant-name">Tenant name</Label>
            <Input
              id="invite-tenant-name"
              value={tenantName}
              onChange={(event) => setTenantName(event.target.value)}
              placeholder="Acme Corp"
              required
              disabled={submitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-owner-name">Owner name (optional)</Label>
              <Input
                id="invite-owner-name"
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                placeholder="Acme Owner"
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-owner-email">Owner email</Label>
              <Input
                id="invite-owner-email"
                type="email"
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                placeholder="owner@acme.com"
                required
                disabled={submitting}
              />
            </div>
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
