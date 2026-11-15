import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'

import { buildDocsSearchIndex, filterDocsSearch } from '@/docs/search'

const SEARCH_INDEX = buildDocsSearchIndex()
const GROUP_STARTS: Record<string, string> = {
  introduction: 'Getting started',
  'inside-hikyaku': 'Concepts and architecture',
  'api-reference': 'Reference',
  configuration: 'Operations',
}

export type DocsSidebarProps = {
  activeSlug: string
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

export function DocsSidebar({ activeSlug }: DocsSidebarProps) {
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
              <Fragment key={item.id}>
                {!query.trim() && GROUP_STARTS[item.id] ? (
                  <li className="docs-sidebar-group">{GROUP_STARTS[item.id]}</li>
                ) : null}
                <li>
                  <Link
                    to={`/docs/${item.id}`}
                    className={
                      activeSlug === item.id
                        ? 'docs-sidebar-link docs-sidebar-link--active'
                        : 'docs-sidebar-link'
                    }
                    aria-current={activeSlug === item.id ? 'page' : undefined}
                    onClick={() => setQuery('')}
                  >
                    {item.label}
                  </Link>
                </li>
              </Fragment>
            ))
          )}
        </ul>
      </nav>
    </aside>
  )
}
