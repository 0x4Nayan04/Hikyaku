import type { ReactNode } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { PageEmpty } from '@/components/console/PageEmpty'
import { cn } from '@/lib/utils'

type DataPanelProps = {
  title?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  empty?: ReactNode
  emptyAlign?: 'center' | 'start'
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
  emptyAlign = 'center',
  emptyFlush = false,
  loading,
  actions,
  className,
}: DataPanelProps) {
  return (
    <Card
      className={cn(
        'border-border',
        loading && 'console-refreshing',
        className,
      )}
    >
      {title ? (
        <CardHeader className="gap-0 border-border/40 bg-muted/5 px-4 py-2.5 md:px-5">
          <div
            className={cn(
              'data-panel-head',
              actions && 'data-panel-head--with-actions',
            )}
          >
            <div className="data-panel-head__main">
              <CardTitle className="font-mono text-xs font-semibold tracking-wider text-muted-strong uppercase">
                {title}
              </CardTitle>
              {description ? (
                <p className="data-panel-head__desc">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="data-panel-head__actions">{actions}</div> : null}
          </div>
        </CardHeader>
      ) : null}
      {empty ? (
        emptyFlush ? (
          empty
        ) : (
          <PageEmpty align={emptyAlign}>{empty}</PageEmpty>
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
