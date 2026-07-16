import type { ReactNode } from 'react'
import { LandingFrame } from '@/components/landing/LandingFrame'

export function AppCatalogShell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`app-page flex h-dvh flex-col overflow-hidden ${className}`.trim()}>
      <LandingFrame>{children}</LandingFrame>
    </div>
  )
}

export { LandingFrameInner } from '@/components/landing/LandingFrameInner'
export { LandingSectionBlock } from '@/components/landing/LandingSectionBlock'
