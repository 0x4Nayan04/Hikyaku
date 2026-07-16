import type { ReactNode } from 'react'
import { AlertOctagon, AlertTriangle, Info, Lightbulb } from 'lucide-react'

type DocsCalloutVariant = 'info' | 'warning' | 'tip' | 'danger'

type DocsCalloutProps = {
  variant: DocsCalloutVariant
  label?: string
  children: ReactNode
}

const VARIANT_META: Record<
  DocsCalloutVariant,
  { defaultLabel: string; Icon: typeof Info }
> = {
  info: { defaultLabel: 'Info', Icon: Info },
  warning: { defaultLabel: 'Warning', Icon: AlertTriangle },
  tip: { defaultLabel: 'Tip', Icon: Lightbulb },
  danger: { defaultLabel: 'Caution', Icon: AlertOctagon },
}

export function DocsCallout({ variant, label, children }: DocsCalloutProps) {
  const meta = VARIANT_META[variant]
  const Icon = meta.Icon
  const heading = label ?? meta.defaultLabel

  return (
    <aside className={`docs-v2-callout docs-v2-callout--${variant}`} role="note">
      <div className="docs-v2-callout-head">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{heading}</span>
      </div>
      <div className="docs-v2-callout-body">{children}</div>
    </aside>
  )
}
