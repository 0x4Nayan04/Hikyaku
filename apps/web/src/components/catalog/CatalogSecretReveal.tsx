import { Copy } from 'lucide-react'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import { cn } from '@/lib/utils'

type CatalogSecretRevealProps = {
  value: string
  onCopy: () => void
  copyLabel?: string
  hint?: string
  className?: string
}

export function CatalogSecretReveal({
  value,
  onCopy,
  copyLabel = 'Copy',
  hint = 'Store securely before closing this dialog.',
  className,
}: CatalogSecretRevealProps) {
  return (
    <div className={cn('catalog-secret-reveal', className)}>
      <div className="catalog-secret-reveal__bar">
        <span className="catalog-secret-reveal__label">Shown once</span>
        <span className="catalog-secret-reveal__hint">{hint}</span>
      </div>
      <div className="catalog-secret-reveal__field">
        <code className="catalog-secret-reveal__value">{value}</code>
        <CatalogButton size="sm"
          type="button"
          variant="secondary"
          className="catalog-secret-reveal__copy h-auto min-h-0"
          onClick={onCopy}
          aria-label={copyLabel}
        >
          <Copy className="size-3.5" aria-hidden="true" />
          <span>{copyLabel}</span>
        </CatalogButton>
      </div>
    </div>
  )
}
