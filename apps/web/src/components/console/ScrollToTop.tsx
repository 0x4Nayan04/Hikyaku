import { ArrowUp } from 'lucide-react'
import { useCallback, useEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

const SCROLL_THRESHOLD = 80

type ScrollToTopProps = {
  scrollContainerRef: RefObject<HTMLElement | null>
}

export function ScrollToTop({ scrollContainerRef }: ScrollToTopProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const updateVisibility = () => {
      const scrollable = container.scrollHeight > container.clientHeight + 1
      setVisible(scrollable && container.scrollTop > SCROLL_THRESHOLD)
    }

    updateVisibility()
    container.addEventListener('scroll', updateVisibility, { passive: true })

    const resizeObserver = new ResizeObserver(updateVisibility)
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', updateVisibility)
      resizeObserver.disconnect()
    }
  }, [scrollContainerRef])

  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [scrollContainerRef])

  return createPortal(
    <button
      type="button"
      aria-label="Scroll to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      onClick={scrollToTop}
      className={cn(
        'scroll-to-top catalog-focus fixed z-50 inline-flex size-9 items-center justify-center',
        'border border-border bg-surface text-muted-strong shadow-md',
        'transition-[opacity,transform,visibility,color,border-color,background-color]',
        'duration-150 ease-out hover:border-primary hover:bg-surface hover:text-primary',
        'right-5 bottom-5 md:right-6 md:bottom-6',
        visible
          ? 'pointer-events-auto translate-y-0 opacity-100 visible'
          : 'pointer-events-none translate-y-2 opacity-0 invisible',
      )}
    >
      <ArrowUp className="size-4" aria-hidden="true" />
    </button>,
    document.body,
  )
}
