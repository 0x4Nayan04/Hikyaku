import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DataPanelEmptyProps = {
  title: string
  description: ReactNode
  icon?: LucideIcon
  variant?: 'featured' | 'inline'
  className?: string
}

export function DataPanelEmpty({
  title,
  description,
  icon: Icon,
  variant = 'featured',
  className,
}: DataPanelEmptyProps) {
  return (
    <div
      className={cn(
        'data-panel-empty',
        variant === 'inline' && 'data-panel-empty--inline',
        className,
      )}
    >
      {Icon ? (
        <span className="data-panel-empty__icon" aria-hidden="true">
          <Icon className="size-[1.125rem]" strokeWidth={1.75} />
        </span>
      ) : null}
      <div className="data-panel-empty__content">
        <p className="data-panel-empty__title">{title}</p>
        <p className="data-panel-empty__desc">{description}</p>
      </div>
    </div>
  )
}
