import { useEffect, useState, type FormEvent } from 'react'
import { TriangleAlert } from 'lucide-react'
import { ApiError, createEndpoint, patchEndpoint, rotateEndpointSecret } from '@/api/client'
import type { Endpoint, EndpointWithSecret } from '@/api/types'
import { PageBanner } from '@/components/console/PageBanner'
import { SendEventField } from '@/components/console/SendEventField'
import { SettingsCopyValue } from '@/components/console/SettingsCatalog'
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
import { Input } from '@/components/ui/input'
import { SecretOnceConfirm } from '@/components/ui/secret-once-confirm'
import { toast } from '@/lib/toast'

type EndpointDialogsProps = {
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
  editTarget: Endpoint | null
  onEditTargetChange: (endpoint: Endpoint | null) => void
  rotateTarget: Endpoint | null
  onRotateTargetChange: (endpoint: Endpoint | null) => void
  onChanged: () => Promise<unknown>
}

export function EndpointDialogs({
  createOpen,
  onCreateOpenChange,
  editTarget,
  onEditTargetChange,
  rotateTarget,
  onRotateTargetChange,
  onChanged,
}: EndpointDialogsProps) {
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [secretEndpoint, setSecretEndpoint] = useState<EndpointWithSecret | null>(null)

  useEffect(() => {
    if (editTarget) {
      setEditDescription(editTarget.description ?? '')
      setEditSubmitting(false)
    }
  }, [editTarget])

  function handleCreateOpenChange(open: boolean) {
    onCreateOpenChange(open)
    if (!open) {
      setUrl('')
      setDescription('')
    }
  }

  function handleEditClose() {
    onEditTargetChange(null)
    setEditDescription('')
    setEditSubmitting(false)
  }

  function handleRotateClose() {
    if (rotating) return
    onRotateTargetChange(null)
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    try {
      const created = await createEndpoint({
        url,
        description: description.trim() || undefined,
      })
      handleCreateOpenChange(false)
      setSecretEndpoint(created)
      await onChanged()
      toast.success('Endpoint created')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create endpoint')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editTarget) return

    setEditSubmitting(true)

    try {
      await patchEndpoint(editTarget.id, {
        description: editDescription.trim(),
      })
      handleEditClose()
      await onChanged()
      toast.success('Endpoint updated')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update endpoint')
    } finally {
      setEditSubmitting(false)
    }
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
      <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <div className="catalog-dialog-secret px-[clamp(1.25rem,4vw,var(--space-s2))] pt-[clamp(1.25rem,4vw,var(--space-s2))] pb-4">
            <DialogHeader className="gap-1.5 text-left">
              <DialogTitle className="catalog-dialog-secret__title">Create endpoint</DialogTitle>
              <DialogDescription className="catalog-dialog-secret__desc">
                Register a receiver URL. Signed webhook payloads are POSTed to this address.
              </DialogDescription>
            </DialogHeader>
            <form
              id="create-endpoint-form"
              className="mt-4 flex flex-col gap-4"
              onSubmit={handleCreate}
            >
              <SendEventField
                id="endpoint-url"
                label="URL"
                hint="Must accept POST requests."
                variant="plain"
              >
                <Input
                  id="endpoint-url"
                  type="url"
                  placeholder="https://example.com/webhooks"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  autoFocus
                  required
                />
              </SendEventField>
              <SendEventField
                id="endpoint-description"
                label="Label"
                hint="Optional label (e.g. Production, Staging)."
                variant="plain"
              >
                <Input
                  id="endpoint-description"
                  placeholder="e.g. Production"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </SendEventField>
            </form>
          </div>
          <DialogFooter className="mx-0 mb-0 mt-0 border-t border-border bg-muted/6 px-[clamp(1.25rem,4vw,var(--space-s2))] py-3">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => handleCreateOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button size="sm" type="submit" form="create-endpoint-form" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create endpoint'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog
        open={rotateTarget !== null}
        onOpenChange={(open) => {
          if (!open) handleRotateClose()
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
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

function SecretEndpointDialog({
  secretEndpoint,
  onSecretEndpointChange,
}: {
  secretEndpoint: EndpointWithSecret | null
  onSecretEndpointChange: (endpoint: EndpointWithSecret | null) => void
}) {
  const [secretSaved, setSecretSaved] = useState(false)

  useEffect(() => {
    setSecretSaved(false)
  }, [secretEndpoint?.id, secretEndpoint?.secret])

  function dismiss() {
    onSecretEndpointChange(null)
    setSecretSaved(false)
  }

  return (
    <Dialog
      open={secretEndpoint !== null}
      onOpenChange={(open) => {
        if (!open && secretSaved) dismiss()
      }}
    >
      <DialogContent
        className="gap-0 p-0 sm:max-w-lg"
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (!secretSaved) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (!secretSaved) event.preventDefault()
        }}
      >
        <div className="flex flex-col gap-4 px-[clamp(1.25rem,4vw,var(--space-s2))] pt-[clamp(1.25rem,4vw,var(--space-s2))] pb-4">
          <DialogHeader>
            <DialogTitle>Signing secret</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Copy or download this secret now. The server cannot show it again after you close this
              dialog.
            </DialogDescription>
          </DialogHeader>
          {secretEndpoint ? (
            <>
              <PageBanner
                variant="info"
                title="Shown once"
                description="Use this value to verify webhook signatures. Treat it like a password."
              />
              <SettingsCopyValue
                value={secretEndpoint.secret}
                copyLabel="Secret"
                buttonLabel="Copy"
              />
            </>
          ) : null}
        </div>
        <DialogFooter className="mx-0 mb-0 mt-0 border-t border-border bg-muted/6 px-[clamp(1.25rem,4vw,var(--space-s2))] py-3">
          {secretEndpoint ? (
            <SecretOnceConfirm
              confirmed={secretSaved}
              onConfirmedChange={setSecretSaved}
              secret={secretEndpoint.secret}
              downloadFilename={`hikyaku-endpoint-${secretEndpoint.id}-secret.txt`}
              onDone={dismiss}
            />
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
