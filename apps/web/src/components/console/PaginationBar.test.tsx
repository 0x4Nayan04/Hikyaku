import { describe, expect, it } from 'vitest'
import { lastPageOffset, paginationButtonVariant } from '@/components/console/pagination-utils'

describe('paginationButtonVariant', () => {
  it('uses primary when navigation is available', () => {
    expect(paginationButtonVariant(true)).toBe('primary')
  })

  it('uses secondary when navigation is unavailable', () => {
    expect(paginationButtonVariant(false)).toBe('secondary')
  })
})

describe('lastPageOffset', () => {
  it('moves an empty final page to the preceding page', () => {
    expect(lastPageOffset(25, 25)).toBe(0)
    expect(lastPageOffset(26, 25)).toBe(25)
  })
})
