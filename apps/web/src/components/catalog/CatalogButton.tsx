import * as React from 'react'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

export type CatalogButtonVariant = 'primary' | 'secondary' | 'ghost'
type CatalogButtonSize = 'default' | 'lg'

export type CatalogButtonProps = React.ComponentProps<'button'> & {
  variant?: CatalogButtonVariant
  size?: CatalogButtonSize
  block?: boolean
  asChild?: boolean
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
        'sm-btn catalog-focus h-auto min-h-[var(--form-h)]',
        variant === 'primary' ? 'sm-btn-primary' : variant === 'ghost' ? 'sm-btn-ghost' : 'sm-btn-secondary',
        size === 'lg' && 'sm-btn-lg',
        block && 'sm-btn-block',
        className,
      )}
      {...props}
    />
  )
}
