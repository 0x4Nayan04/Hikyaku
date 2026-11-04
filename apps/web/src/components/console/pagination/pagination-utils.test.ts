import { describe, expect, it } from 'vitest'
import { pageRange } from './pagination-utils'

describe('pageRange', () => {
  it('does not count rows from an unloaded or failed page', () => {
    expect(pageRange(25, 0)).toEqual({ pageStart: 0, pageEnd: 0 })
    expect(pageRange(25, 5)).toEqual({ pageStart: 26, pageEnd: 30 })
  })
})
