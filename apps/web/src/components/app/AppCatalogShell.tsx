import type { ReactNode } from 'react'
import { LandingFrame } from '@/components/landing/LandingFrame'

export function AppCatalogShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-page flex h-dvh flex-col overflow-hidden">
      <LandingFrame>{children}</LandingFrame>
    </div>
  )
}
