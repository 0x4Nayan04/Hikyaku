import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { SecretOnceConfirm } from '@/components/ui/secret-once-confirm'

type SecretOnceDialogProps = {
  open: boolean
  secret: string | null
  onClose: () => void
  downloadFilename: string
  confirmLabel?: string
  className?: string
  footerClassName?: string
  children: ReactNode
}

export function SecretOnceDialog({
  open,
  secret,
  onClose,
  downloadFilename,
  confirmLabel,
  className = 'gap-0 p-0 sm:max-w-lg',
  footerClassName = 'mx-0 mb-0 mt-0 border-t border-border bg-muted/6 px-[clamp(1.25rem,4vw,var(--space-s2))] py-3',
  children,
}: SecretOnceDialogProps) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSaved(false)
  }, [secret, open])

  function close() {
    onClose()
    setSaved(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && saved) close()
      }}
    >
      <DialogContent
        className={className}
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (!saved) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (!saved) event.preventDefault()
        }}
      >
        {children}
        <DialogFooter className={footerClassName}>
          {secret !== null ? (
            <SecretOnceConfirm
              confirmed={saved}
              onConfirmedChange={setSaved}
              secret={secret}
              downloadFilename={downloadFilename}
              confirmLabel={confirmLabel}
              onDone={close}
            />
          ) : (
            <Button type="button" onClick={close}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
