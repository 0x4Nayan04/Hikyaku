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
        <CatalogDialogContent className="gap-0 p-0 sm:max-w-md">
          <div className="catalog-dialog-secret px-[clamp(1.25rem,4vw,var(--space-s2))] pt-[clamp(1.25rem,4vw,var(--space-s2))]">
            <CatalogDialogHeader className="gap-1.5 text-left">
              <CatalogDialogTitle className="catalog-dialog-secret__title">API key</CatalogDialogTitle>
              <CatalogDialogDescription className="catalog-dialog-secret__desc">
                Copy this key now. The server cannot show it again after you close this dialog.
              </CatalogDialogDescription>
            </CatalogDialogHeader>

            {secretKey ? (
              <CatalogSecretReveal
                value={secretKey.api_key}
                hint="Use as a Bearer token for API requests."
                onCopy={() => void copySecret(secretKey.api_key, 'API key')}
                copyLabel="Copy key"
              />
            ) : null}
          </div>

          <CatalogDialogFooter className="mx-0 mb-0 mt-0 border-t border-border bg-muted/[0.06] px-[clamp(1.25rem,4vw,var(--space-s2))] py-3">
            <CatalogButton
              onClick={() => onSecretKeyChange(null)}
              className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
            >
              Done
            </CatalogButton>
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
        <CatalogDialogContent className="sm:max-w-md">
          <CatalogDialogHeader>
            <CatalogDialogTitle>Revoke API key</CatalogDialogTitle>
            <CatalogDialogDescription className="text-muted-strong">
              Requests using {revokeTarget?.prefix}… will start failing immediately. This cannot be
              undone.
            </CatalogDialogDescription>
          </CatalogDialogHeader>
          <CatalogDialogFooter>
            <CatalogButton
              variant="secondary"
              onClick={() => onRevokeTargetChange(null)}
              disabled={revokingId !== null}
              className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
            >
              Cancel
            </CatalogButton>
            <CatalogButton
              onClick={onRevoke}
              disabled={revokingId !== null}
              className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
            >
              {revokingId ? 'Revoking…' : 'Revoke key'}
            </CatalogButton>
          </CatalogDialogFooter>
        </CatalogDialogContent>
      </CatalogDialog>
    </>
  )
}
