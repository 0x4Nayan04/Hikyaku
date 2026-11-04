import { useEffect, useState } from 'react'
import type { EndpointWithSecret } from '@/api/types'
import { PageBanner } from '@/components/console/chrome/PageBanner'
import { CopyValue } from '@/components/console/details/DetailFields'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SecretOnceConfirm } from '@/components/ui/secret-once-confirm'

export function SecretEndpointDialog({
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
              <CopyValue value={secretEndpoint.secret} copyLabel="Secret" buttonLabel="Copy" />
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
