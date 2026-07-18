import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Trash2 } from 'lucide-react'
import { ApiError, deleteAdminTenantUser, resetAdminTenantUserPassword } from '@/api/client'
import type { User } from '@/api/types'
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

const MIN_PASSWORD_LENGTH = 12

type TenantAdminUserActionsProps = {
  tenantId: string
  user: User
  userCount: number
  currentUserId?: string
  onDeleted: (userId: string) => void
}

export function TenantAdminUserActions({
  tenantId,
  user,
  userCount,
  currentUserId,
  onDeleted,
}: TenantAdminUserActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const cannotDelete = userCount <= 1 || currentUserId === user.id

  async function handleDelete() {
    setSubmitting(true)
    try {
      await deleteAdminTenantUser(tenantId, user.id)
      setDeleteOpen(false)
      onDeleted(user.id)
      toast.success('User deleted')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete user')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await resetAdminTenantUserPassword(tenantId, user.id, { password })
      setPassword('')
      setResetOpen(false)
      toast.success('Password reset')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to reset password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex justify-end gap-2">
        <CatalogButton
          size="sm"
          variant="secondary"
          onClick={() => setResetOpen(true)}
        >
          <KeyRound className="size-3.5" aria-hidden="true" />
          Reset password
        </CatalogButton>
        <CatalogButton
          size="sm"
          variant="secondary"
          className="text-status-danger"
          disabled={cannotDelete}
          title={
            userCount <= 1
              ? 'The last user in a tenant cannot be deleted'
              : currentUserId === user.id
                ? 'You cannot delete your own account'
                : undefined
          }
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Delete
        </CatalogButton>
      </div>

      <CatalogDialog open={resetOpen} onOpenChange={(open) => !submitting && setResetOpen(open)}>
        <CatalogDialogContent className="sm:max-w-md">
          <CatalogDialogHeader>
            <CatalogDialogTitle>Reset password</CatalogDialogTitle>
            <CatalogDialogDescription className="text-muted-strong">
              Set a new password for {user.email}. Their open console sessions stay signed in until
              they expire — ask them to sign out on shared devices if this was a compromise.
            </CatalogDialogDescription>
          </CatalogDialogHeader>
          <form className="flex flex-col gap-4" onSubmit={handleReset}>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`reset-password-${user.id}`}>New password</Label>
              <div className="relative">
                <CatalogInput
                  id={`reset-password-${user.id}`}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  minLength={MIN_PASSWORD_LENGTH}
                  maxLength={128}
                  required
                  autoFocus
                  disabled={submitting}
                  className="pr-9"
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-strong transition-colors hover:text-ink"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-strong">
                Use at least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>
            <CatalogDialogFooter>
              <CatalogButton size="sm"
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => setResetOpen(false)}
              >
                Cancel
              </CatalogButton>
              <CatalogButton size="sm" type="submit" disabled={submitting}>
                {submitting ? 'Resetting…' : 'Reset password'}
              </CatalogButton>
            </CatalogDialogFooter>
          </form>
        </CatalogDialogContent>
      </CatalogDialog>

      <CatalogDialog open={deleteOpen} onOpenChange={(open) => !submitting && setDeleteOpen(open)}>
        <CatalogDialogContent className="sm:max-w-md">
          <CatalogDialogHeader>
            <CatalogDialogTitle>Delete user?</CatalogDialogTitle>
            <CatalogDialogDescription className="text-muted-strong">
              {user.email} will permanently lose access to this tenant.
            </CatalogDialogDescription>
          </CatalogDialogHeader>
          <CatalogDialogFooter>
            <CatalogButton size="sm"
              variant="secondary"
              disabled={submitting}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </CatalogButton>
            <CatalogButton size="sm" disabled={submitting} onClick={handleDelete}>
              {submitting ? 'Deleting…' : 'Delete user'}
            </CatalogButton>
          </CatalogDialogFooter>
        </CatalogDialogContent>
      </CatalogDialog>
    </>
  )
}
