import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { DotGridSpotlight } from '@/components/landing/DotGridSpotlight'
import { cn } from '@/lib/utils'

/** Fallback matches --color-primary #1f3a5f when CSS vars are unavailable. */
const PRIMARY_RGB_FALLBACK = '31, 58, 95'

function readPrimaryRgb(el: HTMLElement | null): string {
  if (!el) return PRIMARY_RGB_FALLBACK
  const raw = getComputedStyle(el).getPropertyValue('--color-primary-rgb').trim()
  return raw || PRIMARY_RGB_FALLBACK
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
  const [primaryRgb, setPrimaryRgb] = useState(PRIMARY_RGB_FALLBACK)

  useLayoutEffect(() => {
    setPrimaryRgb(readPrimaryRgb(wrapRef.current))
  }, [])

  return (
    <div ref={wrapRef} className={cn('hero-dot-grid-wrap', wrapClassName)}>
      <div className="hero-dot-grid-mask" aria-hidden="true">
        <DotGridSpotlight
          interactionRef={wrapRef}
          dotColor={`rgba(${primaryRgb}, 0.28)`}
          activeDotColor={`rgba(${primaryRgb}, 0.78)`}
          spacing={20}
          baseRadius={1}
          activeRadius={1.75}
          interactionRadius={168}
          activeMaxAlpha={1}
          activeMinAlpha={0.48}
        />
      </div>
      <div className={cn('relative z-10', className)}>{children}</div>
    </div>
  )
}
