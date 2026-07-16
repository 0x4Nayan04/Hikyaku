import { Copy } from 'lucide-react'
import { PageBanner } from '@/components/console/PageBanner'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import {
  CatalogDialog,
  CatalogDialogContent,
  CatalogDialogDescription,
  CatalogDialogFooter,
  CatalogDialogHeader,
  CatalogDialogTitle,
} from '@/components/catalog/CatalogDialog'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'

type InviteUrlDialogProps = {
  open: boolean
  inviteUrl: string | null
  expiresAt: string | null
  onOpenChange: (open: boolean) => void
}

export function InviteUrlDialog({
  open,
  inviteUrl,
  expiresAt,
  onOpenChange,
}: InviteUrlDialogProps) {
  async function copyInviteUrl() {
    if (!inviteUrl) {
      return
    }

    await navigator.clipboard.writeText(inviteUrl)
    toast.success('Invite link copied')
  }

  return (
    <CatalogDialog open={open} onOpenChange={onOpenChange}>
      <CatalogDialogContent className="sm:max-w-lg">
        <CatalogDialogHeader>
          <CatalogDialogTitle>Invite link</CatalogDialogTitle>
          <CatalogDialogDescription className="text-muted-foreground">
            Copy this link now and send it to the invitee. The server cannot show it again after you
            close this dialog.
          </CatalogDialogDescription>
        </CatalogDialogHeader>

        {inviteUrl ? (
          <div className="flex flex-col gap-4">
            <PageBanner
              variant="info"
              title="Shown once"
              description={
                expiresAt
                  ? `Link expires ${formatDateTime(expiresAt)}. Treat it like a password.`
                  : 'Treat this link like a password.'
              }
            />

            <div className="flex items-center gap-2 border border-border bg-muted/30 p-3">
              <code className="flex-1 overflow-x-auto font-mono text-xs break-all text-foreground">
                {inviteUrl}
              </code>
              <CatalogButton
                type="button"
                variant="secondary"
                className="shrink-0 px-2.5"
                onClick={copyInviteUrl}
                aria-label="Copy invite link"
              >
                <Copy className="size-4" />
              </CatalogButton>
            </div>
          </div>
        ) : null}

        <CatalogDialogFooter>
          <CatalogButton type="button" onClick={() => onOpenChange(false)}>
            Done
          </CatalogButton>
        </CatalogDialogFooter>
      </CatalogDialogContent>
    </CatalogDialog>
  )
}
