import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { DocsHeader } from '@/components/docs/DocsHeader'
import { DocsSidebar } from '@/components/docs/DocsSidebar'
import { LandingFrame } from '@/components/landing/LandingFrame'
import { DOCS_FLAT, DOCS_NAV, findDocItem } from '@/docs/config'
import { APP_NAME } from '@/lib/app-meta'
import { cn } from '@/lib/utils'

function isDocsHomePath(pathname: string): boolean {
  return pathname === '/docs' || pathname === '/docs/'
}

function DocsMobileNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const activePath = location.pathname.replace(/^\/docs\/?/, '')

  return (
    <div className="docs-v2-mobile-nav">
      <select
        className="docs-v2-mobile-nav-select"
        aria-label="Jump to section"
        value={activePath}
        onChange={(event) => {
          const next = event.target.value
          navigate(next ? `/docs/${next}` : '/docs')
        }}
      >
        <option value="">Documentation home</option>
        {DOCS_NAV.map((group) =>
          group.items.map((item) => (
            <option key={item.slug} value={item.slug}>
              {group.label} — {item.label}
            </option>
          )),
        )}
      </select>
    </div>
  )
}

export function DocsLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)
  const isDocsHome = isDocsHomePath(location.pathname)
  const [readingProgress, setReadingProgress] = useState(0)
  const readingProgressRef = useRef(0)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash && DOCS_FLAT.some((item) => item.slug === hash)) {
      navigate(`/docs/${hash}`, { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    const slug = location.pathname.replace(/^\/docs\/?/, '')
    const item = slug ? findDocItem(slug) : null
    document.title = item
      ? `${item.label} — ${APP_NAME} Docs`
      : `Overview — ${APP_NAME} Docs`
  }, [location.pathname])

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const main = mainRef.current

    const scrollToTarget = () => {
      if (hash) {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'instant', block: 'start' })
        return
      }

      main?.scrollTo({ top: 0, behavior: 'instant' })
    }

    requestAnimationFrame(scrollToTarget)
  }, [location.pathname, location.hash])

  useEffect(() => {
    const main = mainRef.current
    if (!main) return

    let tick = 0
    const update = () => {
      cancelAnimationFrame(tick)
      tick = requestAnimationFrame(() => {
        const docHeight = main.scrollHeight - main.clientHeight
        const nextProgress = docHeight > 0 ? Math.min(main.scrollTop / docHeight, 1) : 0
        if (Math.abs(nextProgress - readingProgressRef.current) >= 0.002) {
          readingProgressRef.current = nextProgress
          setReadingProgress(nextProgress)
        }
      })
    }

    update()
    main.addEventListener('scroll', update, { passive: true })
    return () => {
      cancelAnimationFrame(tick)
      main.removeEventListener('scroll', update)
    }
  }, [location.pathname])

  return (
    <div className="docs-v2-shell landing-page flex h-dvh flex-col overflow-hidden">
      <LandingFrame>
        <DocsHeader />
        {!isDocsHome ? (
          <div
            className="docs-v2-progress"
            role="progressbar"
            aria-valuenow={Math.round(readingProgress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Reading progress"
          >
            <div className="docs-v2-progress-inner">
              <div
                className="docs-v2-progress-fill"
                style={{ transform: `scaleX(${readingProgress})` }}
              />
            </div>
          </div>
        ) : null}

        <div className="docs-v2-body">
          <DocsSidebar />
          <main
            id="main-content"
            ref={mainRef}
            className={cn('docs-v2-main', isDocsHome && 'docs-v2-main--home')}
          >
            <DocsMobileNav />
            <Outlet />
          </main>
        </div>
      </LandingFrame>
    </div>
  )
}
