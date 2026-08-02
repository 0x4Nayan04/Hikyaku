import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { ApiError, patchAdminTenant } from '@/api/client'
import type { AdminTenant } from '@/api/types'
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
import { toast } from '@/lib/toast'

type AdminRenameTenantDialogProps = {
  open: boolean
  tenant: AdminTenant | null
  onOpenChange: (open: boolean) => void
  onRenamed: () => void
}

export function AdminRenameTenantDialog({
  open,
  tenant,
  onOpenChange,
  onRenamed,
}: AdminRenameTenantDialogProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && tenant) setName(tenant.name)
  }, [open, tenant])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !submitting) {
      setName('')
    }
    onOpenChange(nextOpen)
  }

  async function handleRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant) return

    setSubmitting(true)
    try {
      await patchAdminTenant(tenant.id, { tenant_name: name.trim() })
      setName('')
      onOpenChange(false)
      onRenamed()
      toast.success('Tenant renamed')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to rename tenant')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename tenant</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update the display name for {tenant?.name}.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleRename}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-tenant-name">Tenant name</Label>
            <Input
              id="rename-tenant-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New name"
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
            <Button
              size="sm"
              type="submit"
              disabled={submitting || !name.trim()}
              className="sm-btn-split"
            >
              <span className="sm-btn-split-label">{submitting ? 'Renaming…' : 'Rename'}</span>
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
