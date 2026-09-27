import { describe, expect, it } from 'vitest'
import { buildDocsSearchIndex, filterDocsSearch } from './search'

describe('docs search', () => {
  const index = buildDocsSearchIndex()

  it('indexes top-level TOC sections', () => {
    expect(index.some((entry) => entry.id === 'signing')).toBe(true)
    expect(index.some((entry) => entry.id === 'api-reference')).toBe(true)
  })

  it('indexes nested headings for lookups', () => {
    expect(index.some((entry) => /node\.js/i.test(entry.label))).toBe(true)
    expect(index.some((entry) => /console path/i.test(entry.label))).toBe(true)
  })

  it('filters by label, id, or section body', () => {
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
    const results = filterDocsSearch(index, 'replay')
    const ids = results.map((entry) => entry.id)
    expect(ids).toContain('console-guide')
    expect(ids).toContain('retries')
  })

  it('matches snake_case field names in section bodies', () => {
    const ids = filterDocsSearch(index, 'replay_count').map((entry) => entry.id)
    expect(ids).toContain('retries')
  })

  it('returns TOC-only rows when the query is empty', () => {
    const results = filterDocsSearch(index, '')
    expect(results.some((entry) => entry.id === 'introduction')).toBe(true)
    expect(results.every((entry) => entry.id !== 'node-js')).toBe(true)
  })
})
