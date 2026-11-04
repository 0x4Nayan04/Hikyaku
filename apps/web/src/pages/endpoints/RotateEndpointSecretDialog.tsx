import { useState } from 'react'
import { ApiError, rotateEndpointSecret } from '@/api/client'
import type { Endpoint, EndpointWithSecret } from '@/api/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { TriangleAlert } from 'lucide-react'
import { SecretEndpointDialog } from './SecretEndpointDialog'

export function RotateEndpointSecretDialog({
  rotateTarget,
  onRotateTargetChange,
  onChanged,
}: {
  rotateTarget: Endpoint | null
  onRotateTargetChange: (endpoint: Endpoint | null) => void
  onChanged: () => Promise<unknown>
}) {
  const [rotating, setRotating] = useState(false)
  const [secretEndpoint, setSecretEndpoint] = useState<EndpointWithSecret | null>(null)
  function handleRotateClose() {
    if (!rotating) onRotateTargetChange(null)
  }
  async function handleRotate() {
    if (!rotateTarget) return
    setRotating(true)
    try {
      const rotated = await rotateEndpointSecret(rotateTarget.id)
      onRotateTargetChange(null)
      setSecretEndpoint(rotated)
      await onChanged()
      toast.success('Signing secret rotated')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to rotate signing secret')
    } finally {
      setRotating(false)
    }
  }
  return (
    <>
      <Dialog
        open={rotateTarget !== null}
        onOpenChange={(open) => {
          if (!open) handleRotateClose()
        }}
      >
        <DialogContent className="gap-0 overflow-y-auto p-0 sm:max-w-md">
          <div className="flex gap-3 border-b border-border bg-surface-muted/40 px-[clamp(1.25rem,4vw,var(--space-s2))] py-5 pr-12">
            <div className="flex size-9 shrink-0 items-center justify-center border border-destructive/30 bg-destructive/10 text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
            </div>
            <DialogHeader className="gap-1.5 text-left">
              <DialogTitle className="text-lg leading-tight">Rotate signing secret?</DialogTitle>
              <DialogDescription className="text-muted-strong">
                Update receivers with the new secret before closing the next dialog.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-[clamp(1.25rem,4vw,var(--space-s2))] py-5">
            <Alert variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>Old signatures will fail verification</AlertTitle>
              <AlertDescription>
                The endpoint URL stays the same. Deliveries keep using this endpoint id, but
                receivers still configured with the previous secret will reject signed POSTs.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="mx-0 mb-0 mt-0">
            <Button size="sm" variant="secondary" onClick={handleRotateClose} disabled={rotating}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void handleRotate()} disabled={rotating}>
              {rotating ? 'Rotating…' : 'Rotate secret'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SecretEndpointDialog
        secretEndpoint={secretEndpoint}
        onSecretEndpointChange={setSecretEndpoint}
      />
    </>
  )
}
