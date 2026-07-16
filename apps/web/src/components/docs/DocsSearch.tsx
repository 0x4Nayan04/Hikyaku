import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'

import { DOCS_FLAT, docPath } from '@/docs/config'
import { DocsBadge } from '@/components/docs/DocsBadge'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

type DocsSearchProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DocsSearch({ open, onOpenChange }: DocsSearchProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useBodyScrollLock(open)

  const results = useMemo(() => {
    if (!query.trim()) return DOCS_FLAT
    const q = query.toLowerCase()
    return DOCS_FLAT.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.groupLabel.toLowerCase().includes(q) ||
        item.badge.includes(q),
    )
  }, [query])

  const close = useCallback(() => {
    onOpenChange(false)
    setQuery('')
  }, [onOpenChange])

  const goTo = useCallback(
    (slug: string) => {
      navigate(docPath(slug))
      close()
    },
    [close, navigate],
  )

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpenChange(!open)
      }
      if (event.key === 'Escape' && open) {
        close()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, onOpenChange, open])

  if (!open) return null

  return (
    <div className="docs-v2-search-overlay" role="presentation">
      <button type="button" className="docs-v2-search-backdrop" onClick={close} aria-label="Close search" />
      <div className="docs-v2-search-dialog" role="dialog" aria-modal="true" aria-label="Search documentation">
        <div className="docs-v2-search-input-wrap">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            className="docs-v2-search-input"
            placeholder="Search documentation…"
            aria-label="Search documentation"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="docs-v2-search-close focus-ring" onClick={close} aria-label="Close">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="docs-v2-search-results" role="listbox" aria-label="Search results">
          {results.length === 0 ? (
            <p className="docs-v2-search-empty">No results for &ldquo;{query}&rdquo;</p>
          ) : (
            results.map((item) => (
              <button
                key={item.slug}
                type="button"
                className="docs-v2-search-result"
                role="option"
                onClick={() => goTo(item.slug)}
              >
                <span className="docs-v2-search-result-top">
                  <span className="docs-v2-search-result-title">{item.label}</span>
                  <DocsBadge type={item.badge} />
                </span>
                <span className="docs-v2-search-result-desc">{item.description}</span>
                <span className="docs-v2-search-result-group">{item.groupLabel}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function DocsSearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="docs-v2-search-trigger focus-ring" onClick={onClick}>
      <Search className="size-3.5" aria-hidden="true" />
      <span>Search docs…</span>
      <kbd className="docs-v2-search-kbd">⌘K</kbd>
    </button>
  )
}
