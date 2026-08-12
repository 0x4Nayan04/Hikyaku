import { useEffect, useState, type FormEvent } from 'react'
import type { Endpoint, EndpointWithSecret } from '@/api/types'
import { PageBanner } from '@/components/console/PageBanner'
import { SendEventField } from '@/components/console/SendEventField'
import { SettingsCopyValue } from '@/components/console/SettingsCatalog'
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

type EndpointDialogsProps = {
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
  url: string
  onUrlChange: (value: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  submitting: boolean
  onCreate: (event: FormEvent<HTMLFormElement>) => void
  editTarget: Endpoint | null
  editDescription: string
  onEditDescriptionChange: (value: string) => void
  editSubmitting: boolean
  onEdit: (event: FormEvent<HTMLFormElement>) => void
  onEditClose: () => void
  secretEndpoint: EndpointWithSecret | null
  onSecretEndpointChange: (endpoint: EndpointWithSecret | null) => void
}

export function EndpointDialogs({
  createOpen,
  onCreateOpenChange,
  url,
  onUrlChange,
  description,
  onDescriptionChange,
  submitting,
  onCreate,
  editTarget,
  editDescription,
  onEditDescriptionChange,
  editSubmitting,
  onEdit,
  onEditClose,
  secretEndpoint,
  onSecretEndpointChange,
}: EndpointDialogsProps) {
  return (
    <>
      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
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
              onSubmit={onCreate}
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
                  onChange={(event) => onUrlChange(event.target.value)}
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
                  onChange={(event) => onDescriptionChange(event.target.value)}
                />
              </SendEventField>
            </form>
          </div>
          <DialogFooter className="mx-0 mb-0 mt-0 border-t border-border bg-muted/6 px-[clamp(1.25rem,4vw,var(--space-s2))] py-3">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => onCreateOpenChange(false)}
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
        onOpenChange={(open) => !open && !editSubmitting && onEditClose()}
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
              <form id="edit-endpoint-form" className="mt-4 flex flex-col gap-4" onSubmit={onEdit}>
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
                    onChange={(event) => onEditDescriptionChange(event.target.value)}
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
              onClick={onEditClose}
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

      <SecretEndpointDialog
        secretEndpoint={secretEndpoint}
        onSecretEndpointChange={onSecretEndpointChange}
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
  }, [secretEndpoint?.id])

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
