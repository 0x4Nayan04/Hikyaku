import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'

import type { DocTocItem } from '@/docs/types'
import { cn } from '@/lib/utils'

type DocsOnPageNavProps = {
  items: DocTocItem[]
}

const READING_LINE_VIEWPORT_RATIO = 0.65

function resolveActiveHeading(items: DocTocItem[]): string | null {
  if (items.length === 0) return null

  const readingLine = window.innerHeight * READING_LINE_VIEWPORT_RATIO
  let activeId = items[0].id
  for (const item of items) {
    const element = document.getElementById(item.id)
    if (!element) continue

    if (element.getBoundingClientRect().top <= readingLine) {
      activeId = item.id
    }
  }

  return activeId
}

export function DocsOnPageNav({ items }: DocsOnPageNavProps) {
  const [activeId, setActiveId] = useState<string | null>(() => {
    const hashId = window.location.hash.slice(1)
    if (hashId && items.some((item) => item.id === hashId)) {
      return hashId
    }
    return items[0]?.id ?? null
  })
  const scrollTargetRef = useRef<string | null>(null)

  const syncActiveHeading = useCallback(() => {
    if (scrollTargetRef.current) return

    const nextId = resolveActiveHeading(items)
    if (nextId) {
      setActiveId((current) => (current === nextId ? current : nextId))
    }
  }, [items])

  useEffect(() => {
    if (items.length === 0) return

    scrollTargetRef.current = null
    syncActiveHeading()

    let tick = 0
    const onScroll = () => {
      cancelAnimationFrame(tick)
      tick = requestAnimationFrame(syncActiveHeading)
    }

    const onScrollEnd = () => {
      scrollTargetRef.current = null
      syncActiveHeading()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scrollend', onScrollEnd)
    window.addEventListener('hashchange', syncActiveHeading)
    window.addEventListener('resize', syncActiveHeading)

    return () => {
      cancelAnimationFrame(tick)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('scrollend', onScrollEnd)
      window.removeEventListener('hashchange', syncActiveHeading)
      window.removeEventListener('resize', syncActiveHeading)
    }
  }, [items, syncActiveHeading])

  const handleClick = useCallback(
    (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
      scrollTargetRef.current = id
      setActiveId(id)
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.replaceState(null, '', `#${id}`)
      event.currentTarget.blur()

      window.setTimeout(() => {
        if (scrollTargetRef.current === id) {
          scrollTargetRef.current = null
          setActiveId(resolveActiveHeading(items) ?? id)
        }
      }, 800)
    },
    [items],
  )

  if (items.length === 0) return null

  return (
    <nav className="docs-v2-onpage" aria-label="On this page">
      <p className="docs-v2-onpage-label">On this page</p>
      <ul className="docs-v2-onpage-list">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                'docs-v2-onpage-link',
                item.level === 3 && 'docs-v2-onpage-link--nested',
                activeId === item.id && 'docs-v2-onpage-link--active',
              )}
              aria-current={activeId === item.id ? 'location' : undefined}
              onClick={handleClick(item.id)}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
