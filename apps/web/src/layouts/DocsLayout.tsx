import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { DocsHeader } from '@/components/docs/DocsHeader'
import { DocsSidebar } from '@/components/docs/DocsSidebar'
import { LandingFrame } from '@/components/landing/LandingFrame'
import { DOCS_TOC } from '@/docs/toc'
import { APP_NAME } from '@/lib/app-meta'

export function DocsLayout() {
  const location = useLocation()
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = `${APP_NAME} Docs`
  }, [])

  useEffect(() => {
    const hash = location.hash.slice(1)
    const body = bodyRef.current

    const scrollToTarget = () => {
      if (hash) {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'instant', block: 'start' })
        return
      }
      body?.scrollTo({ top: 0, behavior: 'instant' })
    }

    requestAnimationFrame(scrollToTarget)
  }, [location.hash, location.pathname])

  return (
    <div className="docs-shell landing-page flex h-dvh flex-col overflow-hidden">
      <LandingFrame>
        <DocsHeader />
        <div ref={bodyRef} className="docs-body">
          <div className="docs-compose">
            <DocsSidebar />
            <main id="main-content" className="docs-main">
              <div className="docs-mobile-nav">
                <select
                  className="docs-mobile-nav-select"
                  aria-label="Jump to section"
                  value={location.hash.slice(1)}
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
            </main>
          </div>
        </div>
      </LandingFrame>
    </div>
  )
}
