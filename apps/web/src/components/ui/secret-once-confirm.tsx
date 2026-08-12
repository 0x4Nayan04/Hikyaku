import { useId } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

type SecretOnceConfirmProps = {
  confirmed: boolean
  onConfirmedChange: (value: boolean) => void
  secret: string
  downloadFilename: string
  onDone: () => void
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Checkpoint before dismissing a one-time secret reveal. */
export function SecretOnceConfirm({
  confirmed,
  onConfirmedChange,
  secret,
  downloadFilename,
  onDone,
}: SecretOnceConfirmProps) {
  const checkboxId = useId()

  return (
    <div className="flex w-full flex-col gap-3">
      <label htmlFor={checkboxId} className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          id={checkboxId}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
          checked={confirmed}
          onChange={(event) => onConfirmedChange(event.target.checked)}
        />
        <span className="leading-snug text-ink">I’ve saved this secret somewhere secure</span>
      </label>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => downloadText(downloadFilename, secret)}
        >
          <Download className="size-3.5" aria-hidden="true" />
          Download
        </Button>
        <Button size="sm" type="button" disabled={!confirmed} onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  )
}
