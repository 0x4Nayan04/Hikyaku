import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { buildDocsSearchIndex, filterDocsSearch } from '@/docs/search'
import { DOCS_TOC } from '@/docs/toc'

const SEARCH_INDEX = buildDocsSearchIndex()

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

export function DocsSidebar() {
  const [activeId, setActiveId] = useState(DOCS_TOC[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterDocsSearch(SEARCH_INDEX, query), [query])

  useEffect(() => {
    const root = document.querySelector('.docs-body')
    if (!(root instanceof HTMLElement)) return

    const sync = () => setActiveId(activeSectionId(root))
    sync()
    root.addEventListener('scroll', sync, { passive: true })
    return () => root.removeEventListener('scroll', sync)
  }, [])

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash && DOCS_TOC.some((item) => item.id === hash)) setActiveId(hash)
  }, [])

  return (
    <aside className="docs-sidebar">
      <nav className="docs-sidebar-nav" aria-label="Contents">
        <p className="docs-sidebar-label">Contents</p>
        <div className="docs-sidebar-search">
          <Search className="docs-sidebar-search__icon" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search docs…"
            aria-label="Search docs"
            className="docs-sidebar-search__input"
          />
        </div>
        <ul className="docs-sidebar-list">
          {results.length === 0 ? (
            <li className="docs-sidebar-empty">No matching sections</li>
          ) : (
            results.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={
                    activeId === item.id
                      ? 'docs-sidebar-link docs-sidebar-link--active'
                      : 'docs-sidebar-link'
                  }
                  aria-current={activeId === item.id ? 'location' : undefined}
                  onClick={() => {
                    setActiveId(item.id)
                    setQuery('')
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))
          )}
        </ul>
      </nav>
    </aside>
  )
}
