import type { EndpointWithSecret } from '@/api/types'
import { PageBanner } from '@/components/console/chrome/PageBanner'
import { CopyValue } from '@/components/console/details/DetailFields'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SecretOnceDialog } from '@/components/ui/secret-once-dialog'

export function SecretEndpointDialog({
  secretEndpoint,
  onSecretEndpointChange,
}: {
  secretEndpoint: EndpointWithSecret | null
  onSecretEndpointChange: (endpoint: EndpointWithSecret | null) => void
}) {
  return (
    <SecretOnceDialog
      open={secretEndpoint !== null}
      secret={secretEndpoint?.secret ?? null}
      onClose={() => onSecretEndpointChange(null)}
      downloadFilename={`hikyaku-endpoint-${secretEndpoint?.id}-secret.txt`}
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
    </SecretOnceDialog>
  )
}
