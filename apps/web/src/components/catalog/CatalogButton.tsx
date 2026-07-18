import * as React from 'react'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

export type CatalogButtonVariant = 'primary' | 'secondary' | 'ghost'
type CatalogButtonSize = 'default' | 'sm' | 'lg'

export type CatalogButtonProps = React.ComponentProps<'button'> & {
  variant?: CatalogButtonVariant
  size?: CatalogButtonSize
  block?: boolean
  asChild?: boolean
}

function sizeClass(size: CatalogButtonSize): string {
  switch (size) {
    case 'sm':
      return 'sm-btn-sm'
    case 'lg':
      return 'sm-btn-lg h-auto'
    case 'default':
      return 'h-auto min-h-[var(--form-h)]'
    default: {
      const _exhaustive: never = size
      return _exhaustive
    }
  }
}

function variantClass(variant: CatalogButtonVariant): string {
  switch (variant) {
    case 'primary':
      return 'sm-btn-primary'
    case 'secondary':
      return 'sm-btn-secondary'
    case 'ghost':
      return 'sm-btn-ghost'
    default: {
      const _exhaustive: never = variant
      return _exhaustive
    }
  }
}

export function CatalogButton({
  className,
  variant = 'primary',
  size = 'default',
  block = false,
  asChild = false,
  type = 'button',
  ...props
}: CatalogButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="catalog-button"
      type={asChild ? undefined : type}
      className={cn(
        'sm-btn catalog-focus',
        sizeClass(size),
        variantClass(variant),
        block && 'sm-btn-block',
        className,
      )}
      {...props}
    />
  )
}
