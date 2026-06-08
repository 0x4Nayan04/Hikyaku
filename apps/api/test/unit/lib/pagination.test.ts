import { describe, expect, it } from 'vitest'
import { parsePagination } from '../../../src/lib/pagination.js'

describe('parsePagination', () => {
  it('defaults when params are omitted', () => {
    expect(parsePagination({})).toEqual({ limit: 50, offset: 0 })
  })

  it('caps limit at 100', () => {
    expect(parsePagination({ limit: '200' })).toEqual({ limit: 100, offset: 0 })
  })

  it('enforces a minimum limit of 1', () => {
    expect(parsePagination({ limit: '0' })).toEqual({ limit: 1, offset: 0 })
  })

  it('enforces a minimum offset of 0', () => {
    expect(parsePagination({ offset: '-5' })).toEqual({ limit: 50, offset: 0 })
  })

  it('parses explicit limit and offset', () => {
    expect(parsePagination({ limit: '25', offset: '10' })).toEqual({ limit: 25, offset: 10 })
  })
})
