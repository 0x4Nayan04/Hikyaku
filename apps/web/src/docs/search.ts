import searchIndex from '@/docs/guide.md?search'
import { DOCS_TOC } from '@/docs/toc'

export type DocsSearchEntry = {
  id: string
  label: string
  text: string
}

export function buildDocsSearchIndex(): DocsSearchEntry[] {
  const entries = [...searchIndex]
  const seen = new Set(entries.map((entry) => entry.id))
  for (const item of DOCS_TOC) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    entries.push({ id: item.id, label: item.label, text: '' })
  }
  return entries
}

export function filterDocsSearch(entries: DocsSearchEntry[], query: string): DocsSearchEntry[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    const byId = new Map(entries.map((entry) => [entry.id, entry]))
    return DOCS_TOC.map((item) => ({
      id: item.id,
      label: item.label,
      text: byId.get(item.id)?.text ?? '',
    }))
  }
  return entries.filter(
    (entry) =>
      entry.label.toLowerCase().includes(needle) ||
      entry.id.includes(needle) ||
      entry.text.toLowerCase().includes(needle),
  )
}
