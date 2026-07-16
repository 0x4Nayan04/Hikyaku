import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageEmptyProps = {
  children: ReactNode
  className?: string
  align?: 'center' | 'start'
}

export function PageEmpty({ children, className, align = 'center' }: PageEmptyProps) {
  return (
    <div
      className={cn(
        'flex min-h-28 flex-col gap-1.5 px-5 py-5 text-sm text-muted-strong',
        align === 'center' ? 'items-center justify-center px-6 py-8 text-center' : 'items-start justify-start',
        className,
      )}
    >
      {children}
    </div>
  )
}
