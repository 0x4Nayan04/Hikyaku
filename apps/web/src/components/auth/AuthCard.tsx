import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type AuthCardProps = {
  children: ReactNode
  className?: string
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div className={cn('app-panel border border-border bg-surface p-6', className)}>{children}</div>
  )
}
