import { useState } from 'react'
import { KeyRound, Trash2 } from 'lucide-react'
import { ApiError, createPasswordReset, deleteAdminTenantUser } from '@/api/client'
import type { User } from '@/api/types'
import { InviteUrlDialog } from '@/components/invites/InviteUrlDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/lib/toast'

type TenantAdminUserActionsProps = {
  tenantId: string
  user: User
  isSoleUser: boolean
  currentUserId?: string
  onDeleted: (userId: string) => void
}

export function TenantAdminUserActions({
  tenantId,
  user,
  isSoleUser,
  currentUserId,
  onDeleted,
}: TenantAdminUserActionsProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [issuingReset, setIssuingReset] = useState(false)
  const [resetLink, setResetLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const cannotDelete = isSoleUser || currentUserId === user.id

  async function handleResetPassword() {
    setIssuingReset(true)
    try {
      const result = await createPasswordReset(tenantId, user.id)
      setResetLink({ url: result.reset_url, expiresAt: result.expires_at })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create reset link')
    } finally {
      setIssuingReset(false)
    }
  }

  async function handleDelete() {
    setSubmitting(true)
    try {
      await deleteAdminTenantUser(tenantId, user.id)
      setOpen(false)
      onDeleted(user.id)
      toast.success('User deleted')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={issuingReset}
          onClick={() => void handleResetPassword()}
        >
          <KeyRound className="size-3.5" aria-hidden="true" />
          {issuingReset ? 'Creating link…' : 'Reset password'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="text-status-danger"
          disabled={cannotDelete}
          title={
            isSoleUser
              ? 'The last user in a tenant cannot be deleted'
              : currentUserId === user.id
                ? 'You cannot delete your own account'
                : undefined
          }
          onClick={() => setOpen(true)}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Delete
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription className="text-muted-strong">
              {user.email} will permanently lose access to this tenant.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              size="sm"
              variant="secondary"
              disabled={submitting}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={submitting} onClick={handleDelete}>
              {submitting ? 'Deleting…' : 'Delete user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InviteUrlDialog
        open={resetLink !== null}
        inviteUrl={resetLink?.url ?? null}
        expiresAt={resetLink?.expiresAt ?? null}
        onOpenChange={(next) => {
          if (!next) setResetLink(null)
        }}
        title="Password reset link"
        description="Copy this link now and send it to the user. The server cannot show it again after you close this dialog."
        copyLabel="Reset link"
      />
    </>
  )
}
