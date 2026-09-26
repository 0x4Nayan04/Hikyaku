import type { ReactNode } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type DataPanelProps = {
  title?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  empty?: ReactNode
  emptyFlush?: boolean
  loading?: boolean
  actions?: ReactNode
  className?: string
}

export function DataPanel({
  title,
  description,
  children,
  footer,
  empty,
  emptyFlush = false,
  loading,
  actions,
  className,
}: DataPanelProps) {
  return (
    <Card className={cn('border-border', loading && 'console-refreshing', className)}>
      {title ? (
        <CardHeader className="gap-0 border-border/40 bg-muted/5 px-4 py-2.5 md:px-5">
          <div className={cn('data-panel-head', actions && 'data-panel-head--with-actions')}>
            <div className="data-panel-head__main">
              <CardTitle className="font-mono text-xs font-semibold tracking-wider text-muted-strong uppercase">
                {title}
              </CardTitle>
              {description ? <p className="data-panel-head__desc">{description}</p> : null}
            </div>
            {actions ? <div className="data-panel-head__actions">{actions}</div> : null}
          </div>
        </CardHeader>
      ) : null}
      {empty ? (
        emptyFlush ? (
          empty
        ) : (
          <div className="flex min-h-28 flex-col items-center justify-center gap-1.5 px-6 py-8 text-center text-sm text-muted-strong">
            {empty}
          </div>
        )
      ) : (
        <CardContent className="p-0">{children}</CardContent>
      )}
      {footer ? (
        <CardFooter className="w-full border-t border-border/40 bg-muted/[0.06] p-0">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  )
}
