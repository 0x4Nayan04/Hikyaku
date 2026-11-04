import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, patchEndpoint } from '@/api/client'
import type { Endpoint } from '@/api/types'
import { SendEventField } from '@/components/console/forms/SendEventField'
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
import { toast } from '@/lib/toast'

export function EditEndpointLabelDialog({
  editTarget,
  onEditTargetChange,
  onChanged,
}: {
  editTarget: Endpoint | null
  onEditTargetChange: (endpoint: Endpoint | null) => void
  onChanged: () => Promise<unknown>
}) {
  const [editDescription, setEditDescription] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  useEffect(() => {
    if (editTarget) {
      setEditDescription(editTarget.description ?? '')
      setEditSubmitting(false)
    }
  }, [editTarget])
  function handleEditClose() {
    onEditTargetChange(null)
    setEditDescription('')
  }
  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editTarget) return
    setEditSubmitting(true)
    try {
      await patchEndpoint(editTarget.id, { description: editDescription.trim() })
      handleEditClose()
      await onChanged()
      toast.success('Endpoint updated')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update endpoint')
    } finally {
      setEditSubmitting(false)
    }
  }
  return (
    <Dialog
      open={editTarget !== null}
      onOpenChange={(open) => !open && !editSubmitting && handleEditClose()}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <div className="catalog-dialog-secret px-[clamp(1.25rem,4vw,var(--space-s2))] pt-[clamp(1.25rem,4vw,var(--space-s2))] pb-4">
          <DialogHeader className="gap-1.5 text-left">
            <DialogTitle className="catalog-dialog-secret__title">Edit label</DialogTitle>
            <DialogDescription className="catalog-dialog-secret__desc">
              Update the label. The receiver URL cannot be changed after creation.
            </DialogDescription>
          </DialogHeader>
          {editTarget ? (
            <form
              id="edit-endpoint-form"
              className="mt-4 flex flex-col gap-4"
              onSubmit={handleEdit}
            >
              <SendEventField
                id="edit-endpoint-url"
                label="URL"
                hint="Cannot be changed after creation."
                variant="plain"
              >
                <p id="edit-endpoint-url" className="endpoint-locked-url" title={editTarget.url}>
                  {editTarget.url}
                </p>
              </SendEventField>
              <SendEventField
                id="edit-endpoint-description"
                label="Label"
                hint="Shown in the endpoint list (e.g. Production, Staging)."
                variant="plain"
              >
                <Input
                  id="edit-endpoint-description"
                  placeholder="e.g. Production"
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  autoFocus
                />
              </SendEventField>
            </form>
          ) : null}
        </div>
        <DialogFooter className="mx-0 mb-0 mt-0 border-t border-border bg-muted/6 px-[clamp(1.25rem,4vw,var(--space-s2))] py-3">
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={handleEditClose}
            disabled={editSubmitting}
          >
            Cancel
          </Button>
          <Button size="sm" type="submit" form="edit-endpoint-form" disabled={editSubmitting}>
            {editSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
