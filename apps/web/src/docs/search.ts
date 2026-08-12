import guide from '@/docs/guide.md?raw'
import { DOCS_TOC } from '@/docs/toc'
import { APP_NAME } from '@/lib/app-meta'

export type DocsSearchEntry = {
  id: string
  label: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Headings (h2/h3) from the docs guide — used for client-side search. */
export function buildDocsSearchIndex(): DocsSearchEntry[] {
  const entries: DocsSearchEntry[] = []
  const seen = new Set<string>()
  const source = guide.replaceAll('{{APP_NAME}}', APP_NAME)

  for (const line of source.split('\n')) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line)
    if (!match) continue
    const label = match[2].trim()
    const id = slugify(label)
    if (!id || seen.has(id)) continue
    seen.add(id)
    entries.push({ id, label })
  }

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
