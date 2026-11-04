import type { ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { copyToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

type DetailFieldListProps = {
  children: ReactNode
  className?: string
}

export function DetailFieldList({ children, className }: DetailFieldListProps) {
  return <div className={cn('settings-catalog-list', className)}>{children}</div>
}

type DetailFieldRowProps = {
  label: string
  children: ReactNode
  action?: ReactNode
  layout?: 'default' | 'stacked'
  className?: string
}

export function DetailFieldRow({
  label,
  children,
  action,
  layout = 'default',
  className,
}: DetailFieldRowProps) {
  return (
    <div
      className={cn(
        'settings-catalog-row',
        layout === 'stacked' && 'settings-catalog-row--stacked',
        className,
      )}
    >
      <span className="settings-catalog-row__label">{label}</span>
      {layout === 'stacked' ? (
        <div className="settings-catalog-row__value settings-catalog-row__value--stacked">
          {children}
        </div>
      ) : (
        <div className="settings-catalog-row__value">
          <div className="settings-catalog-row__content">{children}</div>
          {action ? <div className="settings-catalog-row__action">{action}</div> : null}
        </div>
      )}
    </div>
  )
}

type CopyValueProps = {
  value: string
  copyLabel: string
  buttonLabel?: string
}

export function CopyValue({ value, copyLabel, buttonLabel = 'Copy' }: CopyValueProps) {
  return (
    <div className="settings-copy-value">
      <code className="settings-copy-value__text">{value}</code>
      <Button
        type="button"
        variant="secondary"
        className="settings-copy-value__btn"
        onClick={() => void copyToClipboard(value, copyLabel)}
      >
        <Copy className="size-3.5" aria-hidden="true" />
        <span>{buttonLabel}</span>
      </Button>
    </div>
  )
}

type CopyActionProps = {
  value: string
  copyLabel: string
  className?: string
}

export function CopyAction({ value, copyLabel, className }: CopyActionProps) {
  return (
    <button
      type="button"
      className={cn('settings-inline-copy', className)}
      onClick={() => void copyToClipboard(value, copyLabel)}
      title={`Copy ${copyLabel.toLowerCase()}`}
    >
      <span className="sr-only">Copy {copyLabel}</span>
      <Copy className="size-3.5" aria-hidden="true" />
    </button>
  )
}

type AccountStripProps = {
  name: string
  email: string
  roleLabel: string
  onCopyEmail: () => void
  className?: string
}

function accountInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function AccountStrip({
  name,
  email,
  roleLabel,
  onCopyEmail,
  className,
}: AccountStripProps) {
  return (
    <div className={cn('settings-account-strip', className)}>
      <span className="settings-account-strip__avatar" aria-hidden="true">
        {accountInitials(name)}
      </span>
      <div className="settings-account-strip__main">
        <p className="settings-account-strip__name">{name}</p>
        <div className="settings-account-strip__email">
          <span className="truncate">{email}</span>
          <button
            type="button"
            className="settings-inline-copy"
            onClick={onCopyEmail}
            title="Copy email"
          >
            <span className="sr-only">Copy email</span>
            <Copy className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <span className="settings-account-strip__role">{roleLabel}</span>
    </div>
  )
}
