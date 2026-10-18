import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { buildDocsSearchIndex, filterDocsSearch } from '@/docs/search'

const SEARCH_INDEX = buildDocsSearchIndex()

export type DocsSidebarProps = {
  activeId: string
  onSectionNavigate: (id: string) => void
}

function DocsSearchEmpty({ query, onClear }: { query: string; onClear: () => void }) {
  const trimmed = query.trim()
  if (!trimmed) {
    return <li className="docs-sidebar-empty">No matching sections</li>
  }

  return (
    <li className="docs-sidebar-empty docs-sidebar-empty--no-results">
      <span>No matches for &lsquo;{trimmed}&rsquo;</span>
      <button type="button" className="docs-sidebar-empty__clear focus-ring" onClick={onClear}>
        Clear
      </button>
    </li>
  )
}

export function DocsSidebar({ activeId, onSectionNavigate }: DocsSidebarProps) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterDocsSearch(SEARCH_INDEX, query), [query])

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
            <DocsSearchEmpty query={query} onClear={() => setQuery('')} />
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
                    onSectionNavigate(item.id)
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
