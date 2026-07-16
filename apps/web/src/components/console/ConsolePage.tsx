import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ConsolePageProps = {
  marker?: string
  icon?: ReactNode
  title: string
  description?: string
  actions?: ReactNode
  toolbar?: ReactNode
  children: ReactNode
  className?: string
}

export function ConsolePage({
  marker,
  icon,
  title,
  description,
  actions,
  toolbar,
  children,
  className,
}: ConsolePageProps) {
  return (
    <div className={cn('console-page', className)}>
      <header className="console-page-head">
        <div className="console-page-head-content">
          <div className="console-page-head-row">
            {icon ? <span className="console-page-icon" aria-hidden="true">{icon}</span> : null}
            <div className="console-page-head-main">
              {marker ? <p className="console-section-marker">{marker}</p> : null}
              <h1 className="console-page-title">{title}</h1>
              {description ? <p className="console-page-desc">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="console-page-actions">{actions}</div> : null}
        </div>
      </header>

      {toolbar ? <div className="console-toolbar">{toolbar}</div> : null}

      {children}
    </div>
  )
}
