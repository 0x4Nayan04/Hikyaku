import type { ReactNode } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type FormPanelProps = {
  title?: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  footerAlign?: 'start' | 'end' | 'between'
  titleVariant?: 'default' | 'prominent'
  className?: string
}

const formFieldClasses =
  '[&_input:not([type=checkbox]):not([type=radio]):not(.sm-input)]:sm-input [&_textarea:not(.sm-input)]:sm-input [&_select:not(.sm-input)]:sm-input'

export function FormPanel({
  title,
  description,
  children,
  footer,
  footerAlign = 'start',
  titleVariant = 'default',
  className,
}: FormPanelProps) {
  return (
    <Card className={cn('border-border', className)}>
      {title ? (
        <CardHeader className="gap-0 border-border/40 bg-muted/5 px-4 py-3 md:px-5">
          <CardTitle
            className={cn(
              titleVariant === 'prominent'
                ? 'font-display text-base font-semibold tracking-tight text-ink normal-case'
                : 'font-mono text-xs font-semibold tracking-wider text-muted-strong uppercase',
            )}
          >
            {title}
          </CardTitle>
          {description ? (
            <div className="mt-1.5 text-xs leading-relaxed text-muted-strong">{description}</div>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn('form-panel-content px-4 pb-4 pt-2 md:px-5 md:pb-5 md:pt-3', formFieldClasses)}>
        {children}
      </CardContent>
      {footer ? (
        <CardFooter
          className={cn(
            'flex w-full flex-wrap items-center gap-3 border-t border-border/40 bg-muted/[0.06] px-4 py-3 md:px-5',
            footerAlign === 'end' && 'justify-end',
            footerAlign === 'between' && 'justify-between',
          )}
        >
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  )
}
