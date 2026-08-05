import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ExternalLink, Lock, RotateCcw } from 'lucide-react'
import { ApiError, changePassword } from '@/api/client'
import { AuthFormField } from '@/components/auth/AuthFormField'
import { PageBanner } from '@/components/console/PageBanner'
import { PageLoading } from '@/components/console/PageLoading'
import { DataPanel } from '@/components/console/DataPanel'
import { FormPanel } from '@/components/console/FormPanel'
import { SettingsLayout } from '@/components/console/SettingsLayout'
import { SettingsAccountStrip } from '@/components/console/SettingsCatalog'
import { Button } from '@/components/ui/button'
import { useSession } from '@/providers/session-context'
import { copyToClipboard } from '@/lib/clipboard'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const MIN_PASSWORD_LENGTH = 12

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

export function SettingsProfileTab() {
  const navigate = useNavigate()
  const { session, loading, refresh } = useSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
    setFormError(null)

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setFormError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }

    if (newPassword !== confirmPassword) {
      setFormError('New password and confirmation do not match.')
      return
    }

    setSubmitting(true)

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      await refresh()
      navigate('/login', {
        replace: true,
        state: {
          banner: 'password_updated',
          message: 'Password updated. Sign in again with your new password.',
        },
      })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to change password'
      setFormError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setFormError(null)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const strength = newPassword.length > 0 ? calculateStrength(newPassword) : null

  if (loading && !session) {
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
            <Button size="sm" type="submit" form="security-form" disabled={!canSubmit}>
              <Lock className="size-3.5" aria-hidden="true" />
              {submitting ? 'Updating…' : 'Update password'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleReset}
              disabled={submitting || (!currentPassword && !newPassword && !confirmPassword)}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Clear form
            </Button>
          </div>
        }
      >
        <div className="settings-form-stack">
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
                onChange={setCurrentPassword}
                required
              />

              <div className="settings-password-block">
                <p className="settings-password-block__label">New password</p>

                {!strength ? (
                  <p className="settings-password-block__hint">
                    12–128 characters. No complexity rules — pick something long.
                  </p>
                ) : null}

                <div className="space-y-4">
                  <AuthFormField
                    id="new-password"
                    label="New password"
                    type="password"
                    icon={Lock}
                    autoComplete="new-password"
                    maxLength={128}
                    value={newPassword}
                    onChange={setNewPassword}
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
                        Strength: <span className="font-medium text-ink">{strength.label}</span>
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
                    maxLength={128}
                    value={confirmPassword}
                    onChange={setConfirmPassword}
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
            <Button size="sm" variant="secondary" asChild>
              <Link to="/admin">
                <ExternalLink className="mr-1.5 size-3.5" aria-hidden="true" />
                Open admin console
              </Link>
            </Button>
          </div>
        </FormPanel>
      ) : null}
    </SettingsLayout>
  )
}
