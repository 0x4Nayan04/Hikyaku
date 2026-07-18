import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import { paginationButtonVariant } from '@/components/console/pagination-utils'
import { cn } from '@/lib/utils'

type PaginationBarProps = {
  pageStart: number
  pageEnd: number
  total: number
  pageSize: number
  canGoBack: boolean
  canGoForward: boolean
  onPrevious: () => void
  onNext: () => void
}

export function PaginationBar({
  pageStart,
  pageEnd,
  total,
  pageSize: _pageSize,
  canGoBack,
  canGoForward,
  onPrevious,
  onNext,
}: PaginationBarProps) {
  return (
    <div className="pagination-bar">
      <p className="pagination-bar__count">
        Showing {pageStart.toLocaleString()}–{pageEnd.toLocaleString()} of{' '}
        {total.toLocaleString()}
      </p>
      <div className="pagination-bar__actions">
        <CatalogButton
          size="sm"
          variant={paginationButtonVariant(canGoBack)}
          className={cn(
            'pagination-bar__btn',
            !canGoBack && 'pointer-events-none opacity-40',
          )}
          disabled={!canGoBack}
          onClick={onPrevious}
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Previous
        </CatalogButton>
        <CatalogButton
          size="sm"
          variant={paginationButtonVariant(canGoForward)}
          className={cn(
            'pagination-bar__btn',
            !canGoForward && 'pointer-events-none opacity-40',
          )}
          disabled={!canGoForward}
          onClick={onNext}
        >
          Next
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </CatalogButton>
      </div>
    </div>
  )
}
