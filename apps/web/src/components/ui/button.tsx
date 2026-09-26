import * as React from 'react'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'default' | 'sm'

type ButtonProps = React.ComponentProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

function sizeClass(size: ButtonSize): string {
  switch (size) {
    case 'sm':
      return 'sm-btn-sm'
    case 'default':
      return 'h-auto min-h-[var(--form-h)]'
  }
}

function variantClass(variant: ButtonVariant): string {
  switch (variant) {
    case 'primary':
      return 'sm-btn-primary'
    case 'secondary':
      return 'sm-btn-secondary'
    case 'ghost':
      return 'sm-btn-ghost'
  }
}

export function Button({
  className,
  variant = 'primary',
  size = 'default',
  asChild = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type}
      className={cn('sm-btn catalog-focus', sizeClass(size), variantClass(variant), className)}
      {...props}
    />
  )
}
