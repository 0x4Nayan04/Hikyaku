import { describe, expect, it } from 'vitest'

import { DOCS_PAGES } from './toc'
import { buildDocsSearchIndex, filterDocsSearch } from './search'

describe('docs search', () => {
  const index = buildDocsSearchIndex()

  it('indexes one entry per docs page', () => {
    expect(index.some((entry) => entry.id === 'signing')).toBe(true)
    expect(index.some((entry) => entry.id === 'api-reference')).toBe(true)
    expect(index).toHaveLength(DOCS_PAGES.length)
  })

  it('finds pages by nested heading text, not just page titles', () => {
    const nodeIds = filterDocsSearch(index, 'node.js').map((entry) => entry.id)
    expect(nodeIds).toContain('signing')
    const consoleIds = filterDocsSearch(index, 'console path').map((entry) => entry.id)
    expect(consoleIds).toContain('quick-start')
  })

  it('filters by label, id, or page body', () => {
    const results = filterDocsSearch(index, 'sign')
    expect(results.length).toBeGreaterThan(0)
    expect(
      results.every(
        (entry) =>
          /sign/i.test(entry.label) ||
          entry.id.includes('sign') ||
          entry.text.toLowerCase().includes('sign'),
      ),
    ).toBe(true)
  })

  it('matches replay in the Console guide and Retries bodies', () => {
    const ids = filterDocsSearch(index, 'replay').map((entry) => entry.id)
    expect(ids).toContain('console-guide')
    expect(ids).toContain('retries')
  })

  it('matches snake_case field names in page bodies', () => {
    const ids = filterDocsSearch(index, 'replay_count').map((entry) => entry.id)
    expect(ids).toContain('retries')
  })

  it('finds the contributor walkthrough by a source term', () => {
    const ids = filterDocsSearch(index, 'ingestFanout').map((entry) => entry.id)
    expect(ids).toContain('find-your-way-around-the-code')
  })

  it('returns every page in reading order when the query is empty', () => {
    const results = filterDocsSearch(index, '')
    expect(results.map((entry) => entry.id)).toEqual(DOCS_PAGES.map((page) => page.slug))
  })
})
