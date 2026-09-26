import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted'

const toneStyles: Record<BadgeTone, string> = {
  neutral: 'border-status-neutral-border bg-status-neutral-subtle text-status-neutral',
  info: 'border-status-info-border bg-status-info-subtle text-status-info',
  success: 'border-status-success-border bg-status-success-subtle text-status-success',
  warning: 'border-status-warning-border bg-status-warning-subtle text-status-warning',
  danger: 'border-status-danger-border bg-status-danger-subtle text-status-danger',
  muted: 'border-border bg-muted/50 text-muted-foreground',
}

const badgeVariants = cva(
  'group/badge catalog-focus inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-none border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        outline: 'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
        status:
          'max-w-full border-border py-0 font-mono text-[0.6875rem] leading-none text-foreground',
      },
    },
  },
)

function Badge({
  className,
  variant,
  tone = 'neutral',
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    tone?: BadgeTone
  }) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(
        badgeVariants({ variant }),
        variant === 'status' && toneStyles[tone],
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
