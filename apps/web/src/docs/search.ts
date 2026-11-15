import pageTexts from '@/docs/guide.md?page-search'
import { DOCS_PAGES } from '@/docs/toc'

export type DocsSearchEntry = {
  id: string
  label: string
  text: string
}

export function buildDocsSearchIndex(): DocsSearchEntry[] {
  return DOCS_PAGES.map((page) => ({
    id: page.slug,
    label: page.title,
    text: pageTexts[page.slug] ?? '',
  }))
}

export function filterDocsSearch(entries: DocsSearchEntry[], query: string): DocsSearchEntry[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return entries
  return entries.filter(
    (entry) =>
      entry.label.toLowerCase().includes(needle) ||
      entry.id.includes(needle) ||
      entry.text.toLowerCase().includes(needle),
  )
}
