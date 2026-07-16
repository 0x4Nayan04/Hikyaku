import * as React from 'react'

import { cn } from '@/lib/utils'

function CatalogTextarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="catalog-textarea"
      className={cn(
        'catalog-focus sm-input min-h-[6rem] w-full resize-y rounded-none text-[15px]',
        className,
      )}
      {...props}
    />
  )
}

export { CatalogTextarea }
