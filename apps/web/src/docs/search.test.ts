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

  it('filters by label or id', () => {
    const results = filterDocsSearch(index, 'sign')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((entry) => /sign/i.test(entry.label) || entry.id.includes('sign'))).toBe(
      true,
    )
  })

  it('returns TOC-only rows when the query is empty', () => {
    const results = filterDocsSearch(index, '')
    expect(results.some((entry) => entry.id === 'introduction')).toBe(true)
    expect(results.every((entry) => entry.id !== 'node-js')).toBe(true)
  })
})
