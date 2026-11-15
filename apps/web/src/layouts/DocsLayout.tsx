import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUp, Search } from 'lucide-react'

import { DocsFooter } from '@/components/docs/DocsFooter'
import { DocsHeader } from '@/components/docs/DocsHeader'
import { DocsPager } from '@/components/docs/DocsPager'
import { DocsSidebar } from '@/components/docs/DocsSidebar'
import { LandingFrame } from '@/components/landing/LandingFrame'
import { buildDocsSearchIndex, filterDocsSearch } from '@/docs/search'
import { docsPageBySlug } from '@/docs/toc'
import '@/styles/domains/docs.css'

const MOBILE_SEARCH_INDEX = buildDocsSearchIndex()

function slugFromPathname(pathname: string): string {
  return pathname.replace(/^\/docs\/?/, '').split('/')[0] ?? ''
}

export function DocsLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const bodyRef = useRef<HTMLDivElement>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [mobileQuery, setMobileQuery] = useState('')
  const slug = slugFromPathname(location.pathname)
  const currentPage = docsPageBySlug(slug)
  const mobileResults = useMemo(
    () => filterDocsSearch(MOBILE_SEARCH_INDEX, mobileQuery),
    [mobileQuery],
  )

  useEffect(() => {
    const body = bodyRef.current

    const scrollToTarget = () => {
      if (location.hash) {
        document.getElementById(location.hash.slice(1))?.scrollIntoView({
          behavior: 'instant',
          block: 'start',
        })
        return
      }
      body?.scrollTo({ top: 0, behavior: 'instant' })
    }

    requestAnimationFrame(scrollToTarget)
  }, [location.hash, location.pathname])

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return

    const onScroll = () => {
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

  return (
    <div className="docs-shell landing-page flex h-dvh flex-col overflow-hidden">
      <LandingFrame>
        <DocsHeader />
        <div ref={bodyRef} className="docs-body">
          <div className="docs-compose">
            <DocsSidebar activeSlug={currentPage?.slug ?? ''} />
            <main id="main-content" className="docs-main">
              <nav className="docs-breadcrumb" aria-label="Breadcrumb">
                <ol className="docs-breadcrumb__list">
                  <li>
                    <Link to="/">Home</Link>
                  </li>
                  <li>
                    <Link to="/docs">Docs</Link>
                  </li>
                  {currentPage ? (
                    <li>
                      <a href={`/docs/${currentPage.slug}`} aria-current="page">
                        {currentPage.title}
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
                    aria-label="Jump to page"
                    value={currentPage?.slug ?? ''}
                    onChange={(event) => {
                      const value = event.target.value
                      if (value) navigate(`/docs/${value}`)
                    }}
                  >
                    <option value="">Jump to page</option>
                    {mobileResults.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <Outlet />
              <DocsPager slug={currentPage?.slug ?? ''} />
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
