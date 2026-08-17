import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'

import { DocsFooter } from '@/components/docs/DocsFooter'
import { DocsHeader } from '@/components/docs/DocsHeader'
import { DocsSidebar } from '@/components/docs/DocsSidebar'
import { LandingFrame } from '@/components/landing/LandingFrame'
import { DOCS_TOC } from '@/docs/toc'
import '@/styles/domains/docs.css'

export function DocsLayout() {
  const location = useLocation()
  const bodyRef = useRef<HTMLDivElement>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const hash = location.hash.slice(1)
  const currentSection = useMemo(
    () => DOCS_TOC.find((item) => item.id === hash) ?? null,
    [hash],
  )

  useEffect(() => {
    const body = bodyRef.current

    const scrollToTarget = () => {
      if (hash) {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'instant', block: 'start' })
        return
      }
      body?.scrollTo({ top: 0, behavior: 'instant' })
    }

    requestAnimationFrame(scrollToTarget)
  }, [hash, location.pathname])

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const onScroll = () => setShowBackToTop(body.scrollTop > 480)
    onScroll()
    body.addEventListener('scroll', onScroll, { passive: true })
    return () => body.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = useCallback(() => {
    const body = bodyRef.current
    if (!body) return
    body.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  return (
    <div className="docs-shell landing-page flex h-dvh flex-col overflow-hidden">
      <LandingFrame>
        <DocsHeader />
        <div ref={bodyRef} className="docs-body">
          <div className="docs-compose">
            <DocsSidebar />
            <main id="main-content" className="docs-main">
              <nav className="docs-breadcrumb" aria-label="Breadcrumb">
                <ol className="docs-breadcrumb__list">
                  <li>
                    <Link to="/">Home</Link>
                  </li>
                  <li>
                    <Link to="/docs" aria-current={!currentSection ? 'page' : undefined}>
                      Docs
                    </Link>
                  </li>
                  {currentSection ? (
                    <li>
                      <a href={`#${currentSection.id}`} aria-current="page">
                        {currentSection.label}
                      </a>
                    </li>
                  ) : null}
                </ol>
              </nav>

              <div className="docs-mobile-nav">
                <select
                  className="docs-mobile-nav-select"
                  aria-label="Jump to section"
                  value={hash}
                  onChange={(event) => {
                    window.location.hash = event.target.value
                  }}
                >
                  <option value="">Jump to section</option>
                  {DOCS_TOC.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <Outlet />
              <DocsFooter />
            </main>
          </div>
        </div>
        {showBackToTop ? (
          <button type="button" className="docs-back-to-top focus-ring" onClick={scrollToTop}>
            <ArrowUp className="size-4" aria-hidden="true" />
            Back to top
          </button>
        ) : null}
      </LandingFrame>
    </div>
  )
}
