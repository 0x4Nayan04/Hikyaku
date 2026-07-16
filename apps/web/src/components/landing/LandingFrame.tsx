import type { ReactNode } from 'react'

export function LandingFrame({ children }: { children: ReactNode }) {
  return (
    <div className="landing-frame-outer">
      <div className="landing-frame-column">{children}</div>
    </div>
  )
}
