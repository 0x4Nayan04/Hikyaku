import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SendEventFieldProps = {
  id: string
  label: string
  meta?: string
  hint?: string
  error?: string | null
  action?: ReactNode
  variant?: 'shell' | 'plain'
  children: ReactNode
  className?: string
}

export function SendEventField({
  id,
  label,
  meta,
  hint,
  error,
  action,
  variant = 'shell',
  children,
  className,
}: SendEventFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  if (variant === 'plain') {
    return (
      <div className={cn('send-event-field send-event-field--plain', className)}>
        <div className="send-event-field__head">
          <label htmlFor={id} className="send-event-field__label">
            {label}
          </label>
          {action ? <div className="send-event-field__head-action">{action}</div> : null}
        </div>
        <div className="send-event-field__control">{children}</div>
        {hint ? (
          <p id={hintId} className="send-event-field__hint">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="send-event-field__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('send-event-field', className)}>
      <div className="send-event-field__shell">
        <div className="send-event-field__bar">
          <label htmlFor={id} className="send-event-field__bar-label">
            {label}
          </label>
          {meta ? <span className="send-event-field__bar-meta">{meta}</span> : null}
        </div>
        <div className="send-event-field__body">{children}</div>
      </div>
      {hint ? (
        <p id={hintId} className="send-event-field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="send-event-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
