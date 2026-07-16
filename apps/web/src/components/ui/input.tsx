import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'catalog-focus sm-input h-auto min-h-[var(--form-h)] w-full rounded-none text-[15px] md:text-[15px]',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
