import { Copy } from 'lucide-react'
import { PageBanner } from '@/components/console/PageBanner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/format'
import { copyToClipboard } from '@/lib/clipboard'

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

    await copyToClipboard(inviteUrl, 'Invite link')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <div className="catalog-dialog-secret px-[clamp(1.25rem,4vw,var(--space-s2))] pt-[clamp(1.25rem,4vw,var(--space-s2))] pb-4">
          <DialogHeader className="gap-1.5 text-left">
            <DialogTitle className="catalog-dialog-secret__title">Invite link</DialogTitle>
            <DialogDescription className="catalog-dialog-secret__desc">
              Copy this link now and send it to the invitee. The server cannot show it again after you
              close this dialog.
            </DialogDescription>
          </DialogHeader>

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
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 px-2.5"
                  onClick={copyInviteUrl}
                  aria-label="Copy invite link"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="mx-0 mb-0 mt-0 border-t border-border bg-muted/6 px-[clamp(1.25rem,4vw,var(--space-s2))] py-3">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
