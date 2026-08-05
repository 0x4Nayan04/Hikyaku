import { useState } from 'react'
import { ArrowRight, Copy } from 'lucide-react'
import { ApiError, createAdminInvite } from '@/api/client'
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
import { PageBanner } from '@/components/console/PageBanner'
import { Label } from '@/components/ui/label'
import { formatDateTime } from '@/lib/format'
import { copyToClipboard } from '@/lib/clipboard'
import { toast } from '@/lib/toast'

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
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ inviteUrl: string; expiresAt: string } | null>(
    null,
  )

  function resetForm() {
    setName('')
    setEmail('')
  }

  async function handleInviteUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    try {
      const result = await createAdminInvite({
        kind: 'tenant_user',
        tenant_id: tenantId,
        email: email.trim(),
        name: name.trim() || undefined,
      })
      setInviteResult({ inviteUrl: result.invite_url, expiresAt: result.expires_at })
      toast.success('Invite created')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create invite')
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !submitting) {
      resetForm()
      setInviteResult(null)
    }
    onOpenChange(nextOpen)
  }

  async function copyInviteUrl() {
    if (!inviteResult) return
    await copyToClipboard(inviteResult.inviteUrl, 'Invite link')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {!inviteResult ? (
          <>
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
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite link</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Copy this link now and send it to the invitee. The server cannot show it again after
                you close this dialog.
              </DialogDescription>
            </DialogHeader>

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
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  className="shrink-0 px-2.5"
                  onClick={copyInviteUrl}
                  aria-label="Copy invite link"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button size="sm" type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
