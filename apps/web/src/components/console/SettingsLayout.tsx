import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SettingsLayoutProps = {
  children: ReactNode
  className?: string
}

export function SettingsLayout({ children, className }: SettingsLayoutProps) {
  return (
    <div className={cn('flex w-full flex-col gap-5', className)}>
      {children}
    </div>
  )
}
