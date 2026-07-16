import { useRef, type ReactNode } from 'react'
import { DotGridSpotlight } from '@/components/landing/DotGridSpotlight'
import { cn } from '@/lib/utils'

const DOT_GRID_DEFAULTS = {
  dotColor: 'rgba(124, 183, 255, 0.38)',
  activeDotColor: 'rgba(5, 98, 239, 0.72)',
  spacing: 20,
  baseRadius: 1,
  activeRadius: 1.75,
  interactionRadius: 168,
  activeMaxAlpha: 1,
  activeMinAlpha: 0.48,
}

export function HeroDotGridWrap({
  children,
  className = '',
  wrapClassName = '',
}: {
  children: ReactNode
  className?: string
  wrapClassName?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={wrapRef} className={cn('hero-dot-grid-wrap', wrapClassName)}>
      <div className="hero-dot-grid-mask" aria-hidden="true">
        <DotGridSpotlight interactionRef={wrapRef} {...DOT_GRID_DEFAULTS} />
      </div>
      <div className={cn('relative z-10', className)}>{children}</div>
    </div>
  )
}
