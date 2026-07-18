import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

type AuthFormFieldProps = {
  id: string
  label: string
  type?: React.ComponentProps<'input'>['type']
  value: string
  onChange: (value: string) => void
  icon?: LucideIcon
  hint?: string
  autoComplete?: string
  minLength?: number
  required?: boolean
  readOnly?: boolean
}

export function AuthFormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  icon: Icon,
  hint,
  autoComplete,
  minLength,
  required,
  readOnly,
}: AuthFormFieldProps) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && visible ? 'text' : type

  return (
    <div className="sm-field">
      <label htmlFor={id} className="sm-label">
        {label}
      </label>
      <div className="relative">
        {Icon ? (
          <Icon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-strong"
            strokeWidth={1.75}
            aria-hidden
          />
        ) : null}
        <input
          id={id}
          type={inputType}
          autoComplete={autoComplete}
          minLength={minLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          readOnly={readOnly}
          className={cn(
            'sm-input w-full text-ink',
            Icon && 'pl-9',
            isPassword && 'pr-9',
          )}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-strong hover:text-foreground transition-colors catalog-focus"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
          >
            {visible ? (
              <EyeOff className="size-4" strokeWidth={1.75} aria-hidden />
            ) : (
              <Eye className="size-4" strokeWidth={1.75} aria-hidden />
            )}
          </button>
        ) : null}
      </div>
      {hint ? <p className="sm-field-hint">{hint}</p> : null}
    </div>
  )
}
