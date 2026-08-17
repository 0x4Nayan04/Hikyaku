import { describe, expect, it } from 'vitest'
import { paginationButtonVariant, shouldPaginate } from '@/components/console/pagination-utils'

describe('paginationButtonVariant', () => {
  it('uses primary when navigation is available', () => {
    expect(paginationButtonVariant(true)).toBe('primary')
  })

  it('uses secondary when navigation is unavailable', () => {
    expect(paginationButtonVariant(false)).toBe('secondary')
  })
})

describe('shouldPaginate', () => {
  it('hides the pager on a single first page', () => {
    expect(shouldPaginate(false, 0)).toBe(false)
  })

  it('shows the pager when more pages exist or we are past the first', () => {
    expect(shouldPaginate(true, 0)).toBe(true)
    expect(shouldPaginate(false, 25)).toBe(true)
  })
})
