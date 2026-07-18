import { KeyRound, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { ApiKey, ApiKeyWithSecret } from '@/api/types'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import {
  CatalogDialog,
  CatalogDialogContent,
  CatalogDialogDescription,
  CatalogDialogFooter,
  CatalogDialogHeader,
  CatalogDialogTitle,
} from '@/components/catalog/CatalogDialog'
import { CatalogSecretReveal } from '@/components/catalog/CatalogSecretReveal'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  return (
    <>
      <CatalogDialog
        open={secretKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            onSecretKeyChange(null)
          }
        }}
      >
        <CatalogDialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          <div className="flex gap-3 border-b border-border bg-surface-muted/40 px-[clamp(1.25rem,4vw,var(--space-s2))] py-5 pr-12">
            <div className="flex size-9 shrink-0 items-center justify-center border border-border bg-surface text-primary">
              <KeyRound className="size-4" aria-hidden="true" />
            </div>
            <CatalogDialogHeader className="gap-1.5 text-left">
              <CatalogDialogTitle className="text-lg leading-tight">Your API key is ready</CatalogDialogTitle>
              <CatalogDialogDescription className="text-muted-strong">
                This is the only time the full key will be shown.
              </CatalogDialogDescription>
            </CatalogDialogHeader>
          </div>

          <div className="flex flex-col gap-4 px-[clamp(1.25rem,4vw,var(--space-s2))] py-5">
            {secretKey ? (
              <CatalogSecretReveal
                value={secretKey.api_key}
                hint="Use as a Bearer token for API requests."
                onCopy={() => void copySecret(secretKey.api_key, 'API key')}
                copyLabel="Copy key"
              />
            ) : null}

            <Alert>
              <ShieldCheck aria-hidden="true" />
              <AlertTitle>Store it somewhere secure</AlertTitle>
              <AlertDescription>
                Treat this key like a password. If it is exposed, revoke it and create a new one.
              </AlertDescription>
            </Alert>
          </div>

          <CatalogDialogFooter className="mx-0 mb-0 mt-0">
            <CatalogButton size="sm" onClick={() => onSecretKeyChange(null)}>Done</CatalogButton>
          </CatalogDialogFooter>
        </CatalogDialogContent>
      </CatalogDialog>

      <CatalogDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            onRevokeTargetChange(null)
          }
        }}
      >
        <CatalogDialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <div className="flex gap-3 border-b border-border bg-surface-muted/40 px-[clamp(1.25rem,4vw,var(--space-s2))] py-5 pr-12">
            <div className="flex size-9 shrink-0 items-center justify-center border border-destructive/30 bg-destructive/10 text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
            </div>
            <CatalogDialogHeader className="gap-1.5 text-left">
              <CatalogDialogTitle className="text-lg leading-tight">Revoke API key?</CatalogDialogTitle>
              <CatalogDialogDescription className="text-muted-strong">
                Review the impact before you continue.
              </CatalogDialogDescription>
            </CatalogDialogHeader>
          </div>

          <div className="px-[clamp(1.25rem,4vw,var(--space-s2))] py-5">
            <Alert variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>This action cannot be undone</AlertTitle>
              <AlertDescription>
                Requests using <code className="font-mono font-medium">{revokeTarget?.prefix}…</code>{' '}
                will start failing immediately.
              </AlertDescription>
            </Alert>
          </div>

          <CatalogDialogFooter className="mx-0 mb-0 mt-0">
            <CatalogButton size="sm"
              variant="secondary"
              onClick={() => onRevokeTargetChange(null)}
              disabled={revokingId !== null}
            >
              Cancel
            </CatalogButton>
            <CatalogButton size="sm" onClick={onRevoke} disabled={revokingId !== null}>
              {revokingId ? 'Revoking…' : 'Revoke key'}
            </CatalogButton>
          </CatalogDialogFooter>
        </CatalogDialogContent>
      </CatalogDialog>
    </>
  )
}
