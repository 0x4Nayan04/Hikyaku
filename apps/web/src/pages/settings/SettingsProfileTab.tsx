import { useReducer } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ExternalLink, Lock, RotateCcw } from 'lucide-react'
import { ApiError, changePassword } from '@/api/client'
import { AuthFormField } from '@/components/auth/AuthFormField'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { DataPanel } from '@/components/console/DataPanel'
import { FormPanel } from '@/components/console/FormPanel'
import { SettingsLayout } from '@/components/console/SettingsLayout'
import { SettingsAccountStrip } from '@/components/console/SettingsCatalog'
import { CatalogButton } from '@/components/catalog/CatalogButton'
import type { AppOutletContext } from '@/layouts/app-context'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const MIN_PASSWORD_LENGTH = 12

type PasswordFormState = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
  formError: string | null
  submitting: boolean
  passwordUpdated: boolean
}

type PasswordFormAction =
  | { type: 'set_current_password'; value: string }
  | { type: 'set_new_password'; value: string }
  | { type: 'set_confirm_password'; value: string }
  | { type: 'set_form_error'; error: string | null }
  | { type: 'submit_start' }
  | { type: 'submit_success' }
  | { type: 'submit_end' }

const initialPasswordFormState: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  formError: null,
  submitting: false,
  passwordUpdated: false,
}

function passwordFormReducer(
  state: PasswordFormState,
  action: PasswordFormAction,
): PasswordFormState {
  switch (action.type) {
    case 'set_current_password':
      return { ...state, currentPassword: action.value, passwordUpdated: false }
    case 'set_new_password':
      return { ...state, newPassword: action.value, passwordUpdated: false }
    case 'set_confirm_password':
      return { ...state, confirmPassword: action.value, passwordUpdated: false }
    case 'set_form_error':
      return { ...state, formError: action.error }
    case 'submit_start':
      return { ...state, formError: null, submitting: true, passwordUpdated: false }
    case 'submit_success':
      return {
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        formError: null,
        submitting: false,
        passwordUpdated: true,
      }
    case 'submit_end':
      return { ...state, submitting: false }
    default: {
      action satisfies never
      return state
    }
  }
}

function calculateStrength(password: string): { score: number; label: string } {
  let score = 0
  if (password.length >= MIN_PASSWORD_LENGTH) score += 1
  if (password.length >= 16) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^a-zA-Z0-9]/.test(password)) score += 1

  if (score <= 2) return { score, label: 'Weak' }
  if (score <= 3) return { score, label: 'Fair' }
  if (score <= 4) return { score, label: 'Strong' }
  return { score: 5, label: 'Very strong' }
}

function strengthBarTone(score: number): string {
  if (score <= 2) return 'bg-status-danger'
  if (score <= 3) return 'bg-status-warning'
  return 'bg-primary'
}

async function copyToClipboard(value: string, label: string) {
  await navigator.clipboard.writeText(value)
  toast.success(`${label} copied`)
}

export function SettingsProfileTab() {
  const { session, loadingSession } = useOutletContext<AppOutletContext>()
  const [formState, formDispatch] = useReducer(passwordFormReducer, initialPasswordFormState)
  const { currentPassword, newPassword, confirmPassword, formError, submitting, passwordUpdated } =
    formState

  const isSuperAdmin = session?.user.is_super_admin ?? false
  const roleLabel = isSuperAdmin ? 'Super admin' : 'Tenant operator'
  const passwordsMatch = confirmPassword.length === 0 || newPassword === confirmPassword
  const meetsMinLength = newPassword.length >= MIN_PASSWORD_LENGTH
  const canSubmit =
    Boolean(currentPassword && newPassword && confirmPassword) &&
    passwordsMatch &&
    meetsMinLength &&
    !submitting

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    formDispatch({ type: 'set_form_error', error: null })

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      formDispatch({
        type: 'set_form_error',
        error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      })
      return
    }

    if (newPassword !== confirmPassword) {
      formDispatch({ type: 'set_form_error', error: 'New password and confirmation do not match.' })
      return
    }

    formDispatch({ type: 'submit_start' })

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      formDispatch({ type: 'submit_success' })
      toast.success('Password updated successfully')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to change password'
      formDispatch({ type: 'set_form_error', error: message })
      toast.error(message)
      formDispatch({ type: 'submit_end' })
    }
  }

  function handleReset() {
    formDispatch({ type: 'set_form_error', error: null })
    formDispatch({ type: 'set_current_password', value: '' })
    formDispatch({ type: 'set_new_password', value: '' })
    formDispatch({ type: 'set_confirm_password', value: '' })
  }

  const strength = newPassword.length > 0 ? calculateStrength(newPassword) : null

  if (loadingSession && !session) {
    return <PageLoading variant="detail" />
  }

  if (!session) return null

  return (
    <SettingsLayout>
      <DataPanel title="Account">
        <SettingsAccountStrip
          name={session.user.name}
          email={session.user.email}
          roleLabel={roleLabel}
          onCopyEmail={() => void copyToClipboard(session.user.email, 'Email')}
        />
      </DataPanel>

      <FormPanel
        title="Security"
        description="Password for signing into the console."
        footer={
          <div className="flex flex-wrap items-center gap-3">
            <CatalogButton size="sm"
              type="submit"
              form="security-form"
              disabled={!canSubmit}
            >
              <Lock className="size-3.5" aria-hidden="true" />
              {submitting ? 'Updating…' : 'Update password'}
            </CatalogButton>
            <CatalogButton size="sm"
              variant="secondary"
              onClick={handleReset}
              disabled={
                submitting || (!currentPassword && !newPassword && !confirmPassword)
              }
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset
            </CatalogButton>
          </div>
        }
      >
        <div className="settings-form-stack">
          {passwordUpdated ? (
            <PageBanner
              variant="success"
              title="Password updated"
              description="Your new password is active. Use it the next time you sign in."
            />
          ) : null}

          <form id="security-form" className="space-y-4" onSubmit={handleSubmit}>
            <fieldset className="m-0 space-y-4 border-0 p-0" disabled={submitting}>
              <legend className="sr-only">Change password</legend>

              {formError ? (
                <PageBanner
                  variant="error"
                  title="Password update failed"
                  description={formError}
                />
              ) : null}

              <AuthFormField
                id="current-password"
                label="Current password"
                type="password"
                icon={Lock}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(v) => formDispatch({ type: 'set_current_password', value: v })}
                required
              />

              <div className="settings-password-block">
                <p className="settings-password-block__label">New password</p>

                {!strength ? (
                  <p className="settings-password-block__hint">
                    At least {MIN_PASSWORD_LENGTH} characters with letters, numbers, and symbols.
                  </p>
                ) : null}

                <div className="space-y-4">
                  <AuthFormField
                    id="new-password"
                    label="New password"
                    type="password"
                    icon={Lock}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(v) => formDispatch({ type: 'set_new_password', value: v })}
                    required
                  />
                  {strength ? (
                    <div className="space-y-1.5">
                      <div className="flex gap-1" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((bar) => (
                          <div
                            key={bar}
                            className={cn(
                              'settings-strength-bar',
                              bar <= strength.score ? strengthBarTone(strength.score) : undefined,
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-strong" aria-live="polite">
                        Strength:{' '}
                        <span className="font-medium text-ink">{strength.label}</span>
                        {newPassword.length < MIN_PASSWORD_LENGTH ? (
                          <span className="ml-1 text-muted-strong/60">
                            ({newPassword.length}/{MIN_PASSWORD_LENGTH} min)
                          </span>
                        ) : null}
                      </p>
                    </div>
                  ) : null}

                  <AuthFormField
                    id="confirm-password"
                    label="Confirm new password"
                    type="password"
                    icon={Lock}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(v) => formDispatch({ type: 'set_confirm_password', value: v })}
                    required
                  />
                  {confirmPassword.length > 0 && !passwordsMatch ? (
                    <p className="text-xs text-status-danger" role="alert">
                      Passwords do not match.
                    </p>
                  ) : null}
                </div>
              </div>
            </fieldset>
          </form>
        </div>
      </FormPanel>

      {isSuperAdmin ? (
        <FormPanel title="Administration">
          <div className="flex flex-col gap-3">
            <PageBanner
              variant="info"
              title="Platform administrator"
              description="Tenant-scoped settings such as API keys live in each tenant workspace. Use Admin to manage tenants and invites."
            />
            <CatalogButton size="sm"
              variant="secondary"
              asChild
            >
              <Link to="/admin">
                <ExternalLink className="mr-1.5 size-3.5" aria-hidden="true" />
                Open admin console
              </Link>
            </CatalogButton>
          </div>
        </FormPanel>
      ) : null}
    </SettingsLayout>
  )
}
