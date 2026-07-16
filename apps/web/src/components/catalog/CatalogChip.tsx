import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type CatalogChipTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted'

const toneStyles: Record<CatalogChipTone, string> = {
  neutral: 'border-status-neutral-border bg-status-neutral-subtle text-status-neutral',
  info: 'border-status-info-border bg-status-info-subtle text-status-info',
  success: 'border-status-success-border bg-status-success-subtle text-status-success',
  warning: 'border-status-warning-border bg-status-warning-subtle text-status-warning',
  danger: 'border-status-danger-border bg-status-danger-subtle text-status-danger',
  muted: 'border-border bg-muted/50 text-muted-foreground',
}

const catalogChipVariants = cva(
  'inline-flex h-5 max-w-full items-center justify-center gap-1 overflow-hidden rounded-none border px-2 py-0 text-[0.6875rem] font-medium leading-none',
  {
    variants: {
      variant: {
        status: 'font-mono',
        environment:
          'border-border bg-muted/50 font-sans text-foreground',
        environmentPlaceholder:
          'border-dashed border-border bg-transparent font-sans font-normal italic text-muted-foreground',
        id: 'border-border bg-muted/50 font-mono font-normal text-muted-foreground',
        meta: 'border-border bg-muted/50 font-sans text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'meta',
    },
  },
)

type CatalogChipProps = ComponentProps<'span'> &
  VariantProps<typeof catalogChipVariants> & {
    tone?: CatalogChipTone
    truncate?: boolean
  }

export function CatalogChip({
  className,
  variant,
  tone = 'neutral',
  truncate = false,
  children,
  ...props
}: CatalogChipProps) {
  return (
    <Badge
      variant="outline"
      data-slot="catalog-chip"
      className={cn(
        catalogChipVariants({ variant }),
        variant === 'status' && toneStyles[tone],
        truncate && 'min-w-0 truncate',
        className,
      )}
      {...props}
    >
      {children}
    </Badge>
  )
}
