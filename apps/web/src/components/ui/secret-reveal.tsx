import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SecretRevealProps = {
  value: string
  onCopy: () => void
  copyLabel?: string
  hint?: string
  className?: string
}

export function SecretReveal({
  value,
  onCopy,
  copyLabel = 'Copy',
  hint = 'Store securely before closing this dialog.',
  className,
}: SecretRevealProps) {
  return (
    <div className={cn('catalog-secret-reveal', className)}>
      <div className="catalog-secret-reveal__bar">
        <span className="catalog-secret-reveal__label">Shown once</span>
        <span className="catalog-secret-reveal__hint">{hint}</span>
      </div>
      <div className="catalog-secret-reveal__field">
        <code className="catalog-secret-reveal__value">{value}</code>
        <Button
          size="sm"
          type="button"
          variant="secondary"
          className="catalog-secret-reveal__copy h-auto min-h-0"
          onClick={onCopy}
          aria-label={copyLabel}
        >
          <Copy className="size-3.5" aria-hidden="true" />
          <span>{copyLabel}</span>
        </Button>
      </div>
    </div>
  )
}
