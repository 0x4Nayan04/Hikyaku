import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { ApiError, patchAdminTenant } from '@/api/client'
import type { AdminTenant } from '@/api/types'
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
    <CatalogDialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <CatalogDialogContent className="sm:max-w-md">
        <CatalogDialogHeader>
          <CatalogDialogTitle>Rename tenant</CatalogDialogTitle>
          <CatalogDialogDescription className="text-muted-foreground">
            Update the display name for {tenant?.name}.
          </CatalogDialogDescription>
        </CatalogDialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleRename}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-tenant-name">Tenant name</Label>
            <CatalogInput
              id="rename-tenant-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New name"
              required
              disabled={submitting}
            />
          </div>

          <CatalogDialogFooter>
            <CatalogButton
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
              className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
            >
              Cancel
            </CatalogButton>
            <CatalogButton type="submit" disabled={submitting || !name.trim()} className="sm-btn-split h-[2.125rem] min-h-0">
              <span className="sm-btn-split-label text-[0.8125rem]">
                {submitting ? 'Renaming…' : 'Rename'}
              </span>
              <span className="sm-btn-split-icon" style={{ width: '2.125rem', minWidth: '2.125rem' }}>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </CatalogButton>
          </CatalogDialogFooter>
        </form>
      </CatalogDialogContent>
    </CatalogDialog>
  )
}
