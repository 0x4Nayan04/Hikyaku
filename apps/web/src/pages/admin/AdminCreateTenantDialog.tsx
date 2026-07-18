import { useReducer, useState } from 'react'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { ApiError, createAdminTenant } from '@/api/client'
import type { AdminTenant, User } from '@/api/types'
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

type CreateFormState = {
  tenantName: string
  ownerName: string
  ownerEmail: string
  ownerPassword: string
  submitting: boolean
}

type CreateFormAction =
  | { type: 'set_field'; field: keyof Omit<CreateFormState, 'submitting'>; value: string }
  | { type: 'submit_start' }
  | { type: 'submit_end' }
  | { type: 'reset' }

const initialCreateFormState: CreateFormState = {
  tenantName: '',
  ownerName: '',
  ownerEmail: '',
  ownerPassword: '',
  submitting: false,
}

function createFormReducer(state: CreateFormState, action: CreateFormAction): CreateFormState {
  switch (action.type) {
    case 'set_field':
      return { ...state, [action.field]: action.value }
    case 'submit_start':
      return { ...state, submitting: true }
    case 'submit_end':
      return { ...state, submitting: false }
    case 'reset':
      return initialCreateFormState
  }
}

type AdminCreateTenantDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (result: { tenant: AdminTenant; user: User }) => void
}

export function AdminCreateTenantDialog({
  open,
  onOpenChange,
  onCreated,
}: AdminCreateTenantDialogProps) {
  const [form, dispatch] = useReducer(createFormReducer, initialCreateFormState)
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState<'form' | 'confirm'>('form')

  async function handleConfirm() {
    dispatch({ type: 'submit_start' })

    try {
      const result = await createAdminTenant({
        tenant_name: form.tenantName.trim(),
        owner_name: form.ownerName.trim(),
        owner_email: form.ownerEmail.trim(),
        owner_password: form.ownerPassword,
      })
      dispatch({ type: 'reset' })
      setStep('form')
      onOpenChange(false)
      onCreated(result)
      toast.success('Tenant created')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create tenant')
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
      <CatalogDialogContent className="sm:max-w-lg">
        <CatalogDialogHeader>
          <CatalogDialogTitle>Create tenant</CatalogDialogTitle>
          <CatalogDialogDescription className="text-muted-foreground">
            Creates a tenant and its first owner user. The owner signs in with the password you set
            here.
          </CatalogDialogDescription>
        </CatalogDialogHeader>

        {step === 'form' ? (
          <form className="flex flex-col gap-4" onSubmit={handleFormSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tenant-name">Tenant name</Label>
              <CatalogInput
                id="tenant-name"
                value={form.tenantName}
                onChange={(event) =>
                  dispatch({ type: 'set_field', field: 'tenantName', value: event.target.value })
                }
                placeholder="Acme Corp"
                required
                disabled={form.submitting}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="owner-name">Owner name</Label>
                <CatalogInput
                  id="owner-name"
                  value={form.ownerName}
                  onChange={(event) =>
                    dispatch({ type: 'set_field', field: 'ownerName', value: event.target.value })
                  }
                  placeholder="Acme Owner"
                  required
                  disabled={form.submitting}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="owner-email">Owner email</Label>
                <CatalogInput
                  id="owner-email"
                  type="email"
                  value={form.ownerEmail}
                  onChange={(event) =>
                    dispatch({ type: 'set_field', field: 'ownerEmail', value: event.target.value })
                  }
                  placeholder="owner@acme.com"
                  required
                  disabled={form.submitting}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="owner-password">Owner password</Label>
              <div className="relative">
                <CatalogInput
                  id="owner-password"
                  type={showPassword ? 'text' : 'password'}
                  minLength={MIN_PASSWORD_LENGTH}
                  value={form.ownerPassword}
                  onChange={(event) =>
                    dispatch({ type: 'set_field', field: 'ownerPassword', value: event.target.value })
                  } className="pr-9"
                  required
                  disabled={form.submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-strong hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" strokeWidth={1.75} aria-hidden />
                  ) : (
                    <Eye className="size-4" strokeWidth={1.75} aria-hidden />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-strong">
                Use at least {MIN_PASSWORD_LENGTH} characters. Share securely with the tenant owner.
              </p>
            </div>

            <CatalogDialogFooter>
              <CatalogButton size="sm"
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                disabled={form.submitting}
              >
                Cancel
              </CatalogButton>
              <CatalogButton size="sm" type="submit" className="sm-btn-split">
                <span className="sm-btn-split-label">Review</span>
                <span className="sm-btn-split-icon">
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
                  <span className="text-muted-strong">Tenant: </span>
                  {form.tenantName}
                </div>
                <div>
                  <span className="text-muted-strong">Owner: </span>
                  {form.ownerName} &lt;{form.ownerEmail}&gt;
                </div>
                <div>
                  <span className="text-muted-strong">Password: </span>
                  {'•'.repeat(Math.min(form.ownerPassword.length, 20))}
                </div>
              </div>
            </div>
            <CatalogDialogFooter>
              <CatalogButton size="sm"
                type="button"
                variant="secondary"
                onClick={() => setStep('form')}
                disabled={form.submitting}
              >
                Back
              </CatalogButton>
              <CatalogButton size="sm"
                type="button"
                onClick={handleConfirm}
                disabled={form.submitting} className="sm-btn-split"
              >
                <span className="sm-btn-split-label">
                  {form.submitting ? 'Creating…' : 'Create tenant'}
                </span>
                <span className="sm-btn-split-icon">
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
