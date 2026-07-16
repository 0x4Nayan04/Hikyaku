import { useEffect, useState } from 'react'

type UseScrollSpyOptions = {
  rootMarginTop?: number
}

function getNavHeight(): number {
  if (typeof document === 'undefined') return 64
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--nav-height').trim()
  if (!raw) return 64
  const num = parseFloat(raw)
  if (raw.endsWith('rem')) {
    return num * parseFloat(getComputedStyle(document.documentElement).fontSize)
  }
  return num
}

export function useScrollSpy(sectionIds: string[], options: UseScrollSpyOptions = {}) {
  const { rootMarginTop = getNavHeight() } = options
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (sectionIds.length === 0) return

    const ratios = new Map<string, number>()

    const pickActive = () => {
      let bestId: string | null = null
      let bestRatio = 0

      for (const id of sectionIds) {
        const ratio = ratios.get(id) ?? 0
        if (ratio > bestRatio) {
          bestRatio = ratio
          bestId = id
        }
      }

      setActiveId(bestRatio >= 0.2 ? bestId : null)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
        pickActive()
      },
      {
        rootMargin: `-${rootMarginTop}px 0px -40% 0px`,
        threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1],
      },
    )

    for (const id of sectionIds) {
      const element = document.getElementById(id)
      if (element) {
        observer.observe(element)
      }
    }

    return () => observer.disconnect()
  }, [sectionIds, rootMarginTop])

  return activeId
}
