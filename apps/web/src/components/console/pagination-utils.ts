import type { CatalogButtonVariant } from '@/components/catalog/CatalogButton'

/**
 * Returns a button variant for pagination navigation buttons.
 * Enabled buttons use 'primary' to stand out, disabled buttons use 'secondary'
 * so they appear visually distinct (disabled styling is handled via CSS).
 */
export function paginationButtonVariant(canNavigate: boolean): CatalogButtonVariant {
  return canNavigate ? 'primary' : 'secondary'
}

export function shouldPaginate(total: number, pageSize: number): boolean {
  return total > pageSize
}
