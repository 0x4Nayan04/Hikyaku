import type { ButtonVariant } from '@/components/ui/button'

/**
 * Returns a button variant for pagination navigation buttons.
 * Enabled buttons use 'primary' to stand out, disabled buttons use 'secondary'
 * so they appear visually distinct (disabled styling is handled via CSS).
 */
export function paginationButtonVariant(canNavigate: boolean): ButtonVariant {
  return canNavigate ? 'primary' : 'secondary'
}

export function shouldPaginate(total: number, pageSize: number): boolean {
  return total > pageSize
}

export function lastPageOffset(total: number, pageSize: number): number {
  return Math.max(0, Math.floor((total - 1) / pageSize) * pageSize)
}
