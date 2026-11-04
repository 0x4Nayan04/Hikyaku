import { useState, type FormEvent } from 'react'
import { ApiError, createEndpoint } from '@/api/client'
import type { EndpointWithSecret } from '@/api/types'
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
import { SecretEndpointDialog } from './SecretEndpointDialog'

export function CreateEndpointDialog({
  createOpen,
  onCreateOpenChange,
  onChanged,
}: {
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
  onChanged: () => Promise<unknown>
}) {
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [secretEndpoint, setSecretEndpoint] = useState<EndpointWithSecret | null>(null)
  function handleCreateOpenChange(open: boolean) {
    onCreateOpenChange(open)
    if (!open) {
      setUrl('')
      setDescription('')
    }
  }
  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const created = await createEndpoint({ url, description: description.trim() || undefined })
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
  return (
    <>
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!submitting) handleCreateOpenChange(open)
        }}
      >
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

      <SecretEndpointDialog
        secretEndpoint={secretEndpoint}
        onSecretEndpointChange={setSecretEndpoint}
      />
    </>
  )
}
