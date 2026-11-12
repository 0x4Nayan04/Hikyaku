import { useState } from 'react'
import { ApiError, removeEndpoint } from '@/api/client'
import type { Endpoint } from '@/api/types'
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

export function RemoveEndpointDialog({
  target,
  onTargetChange,
  onChanged,
}: {
  target: Endpoint | null
  onTargetChange: (endpoint: Endpoint | null) => void
  onChanged: () => Promise<unknown>
}) {
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  function close() {
    if (removing) return
    setError(null)
    onTargetChange(null)
  }
  async function remove() {
    if (!target || removing) return
    setRemoving(true)
    setError(null)
    try {
      await removeEndpoint(target.id)
      onTargetChange(null)
      await onChanged()
      toast.success('Endpoint removed')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove endpoint. Try again.')
    } finally {
      setRemoving(false)
    }
  }
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <div className="px-[clamp(1.25rem,4vw,var(--space-s2))] py-5 pr-12">
          <DialogHeader className="gap-1.5 text-left">
            <DialogTitle>Remove endpoint permanently?</DialogTitle>
            <DialogDescription>
              This endpoint cannot be restored or replayed. Delivery history is retained. A delivery
              already claimed for sending may finish. Future sends and retries will stop.
            </DialogDescription>
          </DialogHeader>
          <p className="mt-4 break-all text-sm text-muted-strong">{target?.url}</p>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="mx-0 mb-0 mt-0">
          <Button size="sm" variant="secondary" disabled={removing} onClick={close}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-destructive"
            variant="secondary"
            disabled={removing}
            onClick={() => void remove()}
          >
            {removing ? 'Removing…' : 'Remove permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
