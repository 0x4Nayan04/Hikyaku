import { Skeleton } from '@/components/ui/skeleton'

type PageLoadingVariant = 'table' | 'detail' | 'detail-metrics' | 'cards' | 'inline'

type PageLoadingProps = {
  variant?: PageLoadingVariant
}

export function PageLoading({ variant = 'table' }: PageLoadingProps) {
  switch (variant) {
    case 'inline':
      return (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-48" />
        </div>
      )
    case 'cards':
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-[var(--radius)]" />
          ))}
        </div>
      )
    case 'detail-metrics':
      return (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
          <Skeleton className="h-56 w-full rounded-[var(--radius)]" />
          <Skeleton className="h-48 w-full rounded-[var(--radius)]" />
        </div>
      )
    case 'detail':
      return (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
          <Skeleton className="h-48 w-full rounded-[var(--radius)]" />
        </div>
      )
    case 'table':
    default:
      return <Skeleton className="h-48 w-full rounded-[var(--radius)]" />
  }
}
