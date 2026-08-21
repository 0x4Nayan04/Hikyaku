import type { ButtonVariant } from '@/components/ui/button'

export const PAGE_SIZE = 25

export function paginationButtonVariant(canNavigate: boolean): ButtonVariant {
  return canNavigate ? 'primary' : 'secondary'
}

export function shouldPaginate(hasMore: boolean, offset: number): boolean {
  return hasMore || offset > 0
}

export function pageRange(offset: number, count: number): { pageStart: number; pageEnd: number } {
  return {
    pageStart: count === 0 ? 0 : offset + 1,
    pageEnd: offset + count,
  }
}
