import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageEmptyProps = {
  children: ReactNode
  className?: string
}

export function PageEmpty({ children, className }: PageEmptyProps) {
  return (
    <div
      className={cn(
        'flex min-h-28 flex-col items-center justify-center gap-1.5 px-6 py-8 text-center text-sm text-muted-strong',
        className,
      )}
    >
      {children}
    </div>
  )
}
