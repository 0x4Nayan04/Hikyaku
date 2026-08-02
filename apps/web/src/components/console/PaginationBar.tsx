import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { paginationButtonVariant } from '@/components/console/pagination-utils'
import { cn } from '@/lib/utils'

type PaginationBarProps = {
  pageStart: number
  pageEnd: number
  total: number
  canGoBack: boolean
  canGoForward: boolean
  onPrevious: () => void
  onNext: () => void
}

export function PaginationBar({
  pageStart,
  pageEnd,
  total,
  canGoBack,
  canGoForward,
  onPrevious,
  onNext,
}: PaginationBarProps) {
  return (
    <div className="pagination-bar">
      <p className="pagination-bar__count">
        Showing {pageStart.toLocaleString()}–{pageEnd.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="pagination-bar__actions">
        <Button
          size="sm"
          variant={paginationButtonVariant(canGoBack)}
          className={cn('pagination-bar__btn', !canGoBack && 'pointer-events-none opacity-40')}
          disabled={!canGoBack}
          onClick={onPrevious}
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Previous
        </Button>
        <Button
          size="sm"
          variant={paginationButtonVariant(canGoForward)}
          className={cn('pagination-bar__btn', !canGoForward && 'pointer-events-none opacity-40')}
          disabled={!canGoForward}
          onClick={onNext}
        >
          Next
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
