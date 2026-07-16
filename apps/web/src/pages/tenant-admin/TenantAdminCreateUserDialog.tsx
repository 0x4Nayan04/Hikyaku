import { useReducer, useState } from 'react'
import { ArrowRight, Copy, Eye, EyeOff } from 'lucide-react'
import { ApiError, createAdminTenantUser } from '@/api/client'
import type { User } from '@/api/types'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import {
  CatalogDialog,
  CatalogDialogContent,
  CatalogDialogDescription,
  CatalogDialogFooter,
  CatalogDialogHeader,
  CatalogDialogTitle,
} from '@/components/catalog/CatalogDialog'
import { CatalogInput } from '@/components/catalog/CatalogInput'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/toast'

const MIN_PASSWORD_LENGTH = 12

type CreateUserFormState = {
  name: string
  email: string
  password: string
  submitting: boolean
}

type CreateUserFormAction =
  | { type: 'set_field'; field: keyof Omit<CreateUserFormState, 'submitting'>; value: string }
  | { type: 'submit_start' }
  | { type: 'submit_end' }
  | { type: 'reset' }

const initialCreateUserFormState: CreateUserFormState = {
  name: '',
  email: '',
  password: '',
  submitting: false,
}

function createUserFormReducer(
  state: CreateUserFormState,
  action: CreateUserFormAction,
): CreateUserFormState {
  switch (action.type) {
    case 'set_field':
      return { ...state, [action.field]: action.value }
    case 'submit_start':
      return { ...state, submitting: true }
    case 'submit_end':
      return { ...state, submitting: false }
    case 'reset':
      return initialCreateUserFormState
  }
}

type TenantAdminCreateUserDialogProps = {
  tenantId: string
  tenantName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUserCreated: (user: User) => void
}

export function TenantAdminCreateUserDialog({
  tenantId,
  tenantName,
  open,
  onOpenChange,
  onUserCreated,
}: TenantAdminCreateUserDialogProps) {
  const [form, dispatch] = useReducer(createUserFormReducer, initialCreateUserFormState)
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState<'form' | 'confirm'>('form')

  async function handleConfirm() {
    dispatch({ type: 'submit_start' })

    try {
      const result = await createAdminTenantUser(tenantId, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      dispatch({ type: 'reset' })
      setStep('form')
      onOpenChange(false)
      onUserCreated(result.user)
      toast.success('User created')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create user')
    } finally {
      dispatch({ type: 'submit_end' })
    }
  }

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStep('confirm')
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !form.submitting) {
      dispatch({ type: 'reset' })
      setStep('form')
    }
    onOpenChange(nextOpen)
  }

  return (
    <CatalogDialog open={open} onOpenChange={handleOpenChange}>
      <CatalogDialogContent className="sm:max-w-md">
        <CatalogDialogHeader>
          <CatalogDialogTitle>Create user</CatalogDialogTitle>
          <CatalogDialogDescription className="text-muted-strong">
            Adds a new operator to {tenantName}. Share the password securely — it is not shown
            again.
          </CatalogDialogDescription>
        </CatalogDialogHeader>

        {step === 'form' ? (
          <form className="flex flex-col gap-4" onSubmit={handleFormSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-name">Full name</Label>
              <CatalogInput
                id="user-name"
                value={form.name}
                onChange={(event) =>
                  dispatch({ type: 'set_field', field: 'name', value: event.target.value })
                }
                required
                disabled={form.submitting}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-email">Email</Label>
              <CatalogInput
                id="user-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  dispatch({ type: 'set_field', field: 'email', value: event.target.value })
                }
                required
                disabled={form.submitting}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-password">Password</Label>
              <div className="relative">
                <CatalogInput
                  id="user-password"
                  type={showPassword ? 'text' : 'password'}
                  minLength={MIN_PASSWORD_LENGTH}
                  value={form.password}
                  onChange={(event) =>
                    dispatch({ type: 'set_field', field: 'password', value: event.target.value })
                  }
                  className="pr-9"
                  required
                  disabled={form.submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-strong hover:text-ink transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  role="switch"
                  aria-checked={showPassword}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" strokeWidth={1.75} aria-hidden />
                  ) : (
                    <Eye className="size-4" strokeWidth={1.75} aria-hidden />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-strong">
                Use at least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>

            <CatalogDialogFooter>
              <CatalogButton
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                disabled={form.submitting}
                className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
              >
                Cancel
              </CatalogButton>
              <CatalogButton type="submit" className="sm-btn-split h-[2.125rem] min-h-0">
                <span className="sm-btn-split-label text-[0.8125rem]">Review</span>
                <span className="sm-btn-split-icon" style={{ width: '2.125rem', minWidth: '2.125rem' }}>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </CatalogButton>
            </CatalogDialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-[var(--radius)] border p-4">
              <p className="text-sm font-medium">Summary</p>
              <div className="grid gap-2 text-sm">
                <div>
                  <span className="text-muted-strong">Name: </span>
                  {form.name}
                </div>
                <div>
                  <span className="text-muted-strong">Email: </span>
                  {form.email}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-strong">Password: </span>
                  <span className="font-mono text-sm">{form.password}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(form.password)
                      toast.success('Password copied')
                    }}
                    className="ml-auto text-muted-strong hover:text-ink transition-colors"
                    aria-label="Copy password"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <CatalogDialogFooter>
              <CatalogButton
                type="button"
                variant="secondary"
                onClick={() => setStep('form')}
                disabled={form.submitting}
                className="h-[2.125rem] min-h-0 px-3.5 text-[0.8125rem]"
              >
                Back
              </CatalogButton>
              <CatalogButton
                type="button"
                onClick={handleConfirm}
                disabled={form.submitting}
                className="sm-btn-split h-[2.125rem] min-h-0"
              >
                <span className="sm-btn-split-label text-[0.8125rem]">
                  {form.submitting ? 'Creating…' : 'Create user'}
                </span>
                <span className="sm-btn-split-icon" style={{ width: '2.125rem', minWidth: '2.125rem' }}>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </CatalogButton>
            </CatalogDialogFooter>
          </div>
        )}
      </CatalogDialogContent>
    </CatalogDialog>
  )
}
