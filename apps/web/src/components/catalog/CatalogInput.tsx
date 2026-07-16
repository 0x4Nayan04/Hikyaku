import * as React from 'react'

import { cn } from '@/lib/utils'

function CatalogInput({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="catalog-input"
      className={cn(
        'catalog-focus sm-input h-auto min-h-[var(--form-h)] w-full rounded-none text-[15px]',
        className,
      )}
      {...props}
    />
  )
}

export { CatalogInput }
