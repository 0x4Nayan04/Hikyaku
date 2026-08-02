import { Copy, KeyRound, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { ApiKey, ApiKeyWithSecret } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SecretReveal } from '@/components/ui/secret-reveal'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { API_BASE } from '@/api/client'
import { buildIngestCurl } from '@/lib/tenant-onboarding'
import { toast } from '@/lib/toast'

async function copySecret(value: string, label: string) {
  await navigator.clipboard.writeText(value)
  toast.success(`${label} copied`)
}

type SettingsApiKeyDialogsProps = {
  secretKey: ApiKeyWithSecret | null
  revokeTarget: ApiKey | null
  revokingId: string | null
  onSecretKeyChange: (secretKey: ApiKeyWithSecret | null) => void
  onRevokeTargetChange: (target: ApiKey | null) => void
  onRevoke: () => void
}

export function SettingsApiKeyDialogs({
  secretKey,
  revokeTarget,
  revokingId,
  onSecretKeyChange,
  onRevokeTargetChange,
  onRevoke,
}: SettingsApiKeyDialogsProps) {
  const ingestCurl = secretKey ? buildIngestCurl(secretKey.api_key, API_BASE) : null

  return (
    <>
      <Dialog
        open={secretKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            onSecretKeyChange(null)
          }
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          <div className="flex gap-3 border-b border-border bg-surface-muted/40 px-[clamp(1.25rem,4vw,var(--space-s2))] py-5 pr-12">
            <div className="flex size-9 shrink-0 items-center justify-center border border-border bg-surface text-primary">
              <KeyRound className="size-4" aria-hidden="true" />
            </div>
            <DialogHeader className="gap-1.5 text-left">
              <DialogTitle className="text-lg leading-tight">Your API key is ready</DialogTitle>
              <DialogDescription className="text-muted-strong">
                This is the only time the full key will be shown.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex flex-col gap-4 px-[clamp(1.25rem,4vw,var(--space-s2))] py-5">
            {secretKey ? (
              <SecretReveal
                value={secretKey.api_key}
                hint="Use as a Bearer token for API requests."
                onCopy={() => void copySecret(secretKey.api_key, 'API key')}
                copyLabel="Copy key"
              />
            ) : null}

            {ingestCurl ? (
              <div className="settings-ingest-curl">
                <div className="settings-ingest-curl__bar">
                  <span className="settings-ingest-curl__label">Try ingest</span>
                  <span className="settings-ingest-curl__hint">
                    Copy into your terminal — key is already filled in.
                  </span>
                </div>
                <pre className="settings-ingest-curl__code">{ingestCurl}</pre>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  className="self-start"
                  onClick={() => void copySecret(ingestCurl, 'curl command')}
                >
                  <Copy className="size-3.5" aria-hidden="true" />
                  Copy curl
                </Button>
              </div>
            ) : null}

            <Alert>
              <ShieldCheck aria-hidden="true" />
              <AlertTitle>Store it somewhere secure</AlertTitle>
              <AlertDescription>
                Treat this key like a password. If it is exposed, revoke it and create a new one.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="mx-0 mb-0 mt-0">
            <Button size="sm" onClick={() => onSecretKeyChange(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            onRevokeTargetChange(null)
          }
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <div className="flex gap-3 border-b border-border bg-surface-muted/40 px-[clamp(1.25rem,4vw,var(--space-s2))] py-5 pr-12">
            <div className="flex size-9 shrink-0 items-center justify-center border border-destructive/30 bg-destructive/10 text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
            </div>
            <DialogHeader className="gap-1.5 text-left">
              <DialogTitle className="text-lg leading-tight">Revoke API key?</DialogTitle>
              <DialogDescription className="text-muted-strong">
                Review the impact before you continue.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-[clamp(1.25rem,4vw,var(--space-s2))] py-5">
            <Alert variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>This action cannot be undone</AlertTitle>
              <AlertDescription>
                Requests using{' '}
                <code className="font-mono font-medium">{revokeTarget?.prefix}…</code> will start
                failing immediately.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="mx-0 mb-0 mt-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onRevokeTargetChange(null)}
              disabled={revokingId !== null}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={onRevoke} disabled={revokingId !== null}>
              {revokingId ? 'Revoking…' : 'Revoke key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
