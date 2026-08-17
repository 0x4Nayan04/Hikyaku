import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ApiError, deleteAdminTenantUser } from '@/api/client'
import type { User } from '@/api/types'
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
  const cannotDelete = isSoleUser || currentUserId === user.id

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
      <div className="flex justify-end">
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
    </>
  )
}
