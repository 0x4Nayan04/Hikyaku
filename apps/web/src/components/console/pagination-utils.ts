import type { ButtonVariant } from '@/components/ui/button'

/**
 * Returns a button variant for pagination navigation buttons.
 * Enabled buttons use 'primary' to stand out, disabled buttons use 'secondary'
 * so they appear visually distinct (disabled styling is handled via CSS).
 */
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
