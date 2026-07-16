import { describe, expect, it } from 'vitest'
import { paginationButtonVariant } from '@/components/console/pagination-utils'

describe('paginationButtonVariant', () => {
  it('uses primary when navigation is available', () => {
    expect(paginationButtonVariant(true)).toBe('primary')
  })

  it('uses secondary when navigation is unavailable', () => {
    expect(paginationButtonVariant(false)).toBe('secondary')
  })
})
