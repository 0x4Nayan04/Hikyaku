import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowUp, Search } from 'lucide-react'

import { DocsFooter } from '@/components/docs/DocsFooter'
import { DocsHeader } from '@/components/docs/DocsHeader'
import { DocsSidebar } from '@/components/docs/DocsSidebar'
import { LandingFrame } from '@/components/landing/LandingFrame'
import { buildDocsSearchIndex, filterDocsSearch } from '@/docs/search'
import { DOCS_TOC } from '@/docs/toc'
import '@/styles/domains/docs.css'

const MOBILE_SEARCH_INDEX = buildDocsSearchIndex()

function activeSectionId(root: HTMLElement): string {
  const last = DOCS_TOC[DOCS_TOC.length - 1]
  if (last && root.scrollTop + root.clientHeight >= root.scrollHeight - 32) {
    return last.id
  }

  const marker = root.getBoundingClientRect().top + 112
  let current = DOCS_TOC[0]?.id ?? ''
  for (const item of DOCS_TOC) {
    const el = document.getElementById(item.id)
    if (!el) continue
    if (el.getBoundingClientRect().top <= marker) current = item.id
  }
  return current
}

export function DocsLayout() {
  const location = useLocation()
  const bodyRef = useRef<HTMLDivElement>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [activeId, setActiveId] = useState(DOCS_TOC[0]?.id ?? '')
  const [mobileQuery, setMobileQuery] = useState('')
  const hash = location.hash.slice(1)
  const currentSection = DOCS_TOC.find((item) => item.id === hash) ?? null
  const mobileResults = useMemo(
    () => filterDocsSearch(MOBILE_SEARCH_INDEX, mobileQuery),
    [mobileQuery],
  )
  const mobileSelectValue = mobileResults.some((item) => item.id === activeId) ? activeId : ''

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
    if (hash && DOCS_TOC.some((item) => item.id === hash)) {
      setActiveId(hash)
    }
  }, [hash])

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return

    const onScroll = () => {
      setActiveId(activeSectionId(body))
      setShowBackToTop(body.scrollTop > 480)
    }
    onScroll()
    body.addEventListener('scroll', onScroll, { passive: true })
    return () => body.removeEventListener('scroll', onScroll)
  }, [])

  function scrollToTop() {
    const body = bodyRef.current
    if (!body) return
    body.scrollTo({ top: 0, behavior: 'auto' })
  }

  function navigateToSection(id: string) {
    setActiveId(id)
    window.location.hash = id
  }

  return (
    <div className="docs-shell landing-page flex h-dvh flex-col overflow-hidden">
      <LandingFrame>
        <DocsHeader />
        <div ref={bodyRef} className="docs-body">
          <div className="docs-compose">
            <DocsSidebar activeId={activeId} onSectionNavigate={navigateToSection} />
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
                <div className="docs-sidebar-search docs-mobile-nav-search">
                  <Search className="docs-sidebar-search__icon" aria-hidden="true" />
                  <input
                    type="search"
                    value={mobileQuery}
                    onChange={(event) => setMobileQuery(event.target.value)}
                    placeholder="Search docs…"
                    aria-label="Search docs"
                    className="docs-sidebar-search__input"
                  />
                </div>
                {mobileResults.length === 0 ? (
                  <div className="docs-sidebar-empty docs-sidebar-empty--no-results docs-mobile-nav-empty">
                    {mobileQuery.trim() ? (
                      <>
                        <span>No matches for &lsquo;{mobileQuery.trim()}&rsquo;</span>
                        <button
                          type="button"
                          className="docs-sidebar-empty__clear focus-ring"
                          onClick={() => setMobileQuery('')}
                        >
                          Clear
                        </button>
                      </>
                    ) : (
                      <span>No matching sections</span>
                    )}
                  </div>
                ) : (
                  <select
                    className="docs-mobile-nav-select"
                    aria-label="Jump to section"
                    value={mobileSelectValue}
                    onChange={(event) => {
                      const id = event.target.value
                      if (id) navigateToSection(id)
                    }}
                  >
                    <option value="">Jump to section</option>
                    {mobileResults.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                )}
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
