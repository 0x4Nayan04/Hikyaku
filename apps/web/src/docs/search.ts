import searchIndex from '@/docs/guide.md?search'
import { DOCS_TOC } from '@/docs/toc'

export type DocsSearchEntry = {
  id: string
  label: string
}

/** Headings (h2/h3) from the docs guide — used for client-side search. */
export function buildDocsSearchIndex(): DocsSearchEntry[] {
  const entries = [...searchIndex]
  const seen = new Set(entries.map((entry) => entry.id))
  for (const item of DOCS_TOC) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    entries.push({ id: item.id, label: item.label })
  }
  return entries
}

export function filterDocsSearch(entries: DocsSearchEntry[], query: string): DocsSearchEntry[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return entries.filter((entry) => DOCS_TOC.some((item) => item.id === entry.id))
  return entries.filter(
    (entry) => entry.label.toLowerCase().includes(needle) || entry.id.includes(needle),
  )
}
