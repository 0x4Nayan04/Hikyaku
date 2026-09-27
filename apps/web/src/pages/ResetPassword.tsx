import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Lock, Mail } from 'lucide-react'
import { MIN_PASSWORD_LENGTH } from '@webhook/shared/constants'
import { ApiError, submitPasswordReset, validatePasswordReset } from '@/api/client'
import type { ValidatePasswordResetResponse } from '@/api/types'
import { AuthFooterLink } from '@/components/auth/AuthFooterLink'
import { AuthFormField } from '@/components/auth/AuthFormField'
import { SignedInLinkPrompt } from '@/components/auth/SignedInLinkPrompt'
import { PageBanner } from '@/components/console/PageBanner'
import { AuthLayout } from '@/layouts/AuthLayout'
import { useSession } from '@/providers/session-context'

function resolveResetLoadError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'reset_expired') {
      return 'This reset link has expired. Ask Admin for a new one.'
    }
    if (err.code === 'reset_used') {
      return 'This reset link has already been used. Ask Admin for a new one, or sign in if you already set a password.'
    }
    return err.message
  }
  return 'Unable to load this reset link. Try again, or ask Admin for a new one.'
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const { session, loading: sessionLoading } = useSession()

  const [reset, setReset] = useState<ValidatePasswordResetResponse | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [loadError, setLoadError] = useState<string | null>(
    token ? null : 'This reset link is missing a token.',
  )
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setReset(null)
    setPassword('')
    setConfirmPassword('')
    setSubmitError(null)

    if (!token) {
      setLoading(false)
      setLoadError('This reset link is missing a token.')
      return
    }

    setLoading(true)
    setLoadError(null)
    let cancelled = false

    validatePasswordReset(token)
      .then((result) => {
        if (!cancelled) {
          setReset(result)
          setLoading(false)
          setLoadError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoading(false)
          setLoadError(resolveResetLoadError(err))
        }
      })

    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    try {
      await submitPasswordReset({ token, password })
      navigate('/login', {
        replace: true,
        state: {
          banner: 'password_updated',
          message: 'Password updated. Sign in with your new password.',
        },
      })
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Unable to reset password. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Password"
      title={
        loading || sessionLoading
          ? 'Checking reset link…'
          : loadError
            ? 'Reset link unavailable'
            : 'Set a new password'
      }
      description={
        loading || sessionLoading
          ? 'Verifying your reset link.'
          : loadError
            ? 'This link cannot be used. Ask Admin for a new reset link, or sign in if you already have a password.'
            : 'Choose a new password for this account. Other sessions will be signed out.'
      }
    >
      {loadError ? (
        <div className="app-panel border border-border bg-surface p-6">
          <PageBanner variant="error" title="Reset link unavailable" description={loadError} />
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p>Need a new link? Ask Admin.</p>
            <AuthFooterLink prompt="Already know your password?" linkLabel="Sign in" to="/login" />
          </div>
        </div>
      ) : loading || sessionLoading ? (
        <div className="app-panel border border-border bg-surface p-6">
          <p className="text-sm text-muted-foreground">Loading reset details…</p>
        </div>
      ) : reset && session ? (
        <SignedInLinkPrompt currentEmail={session.user.email} targetEmail={reset.email} />
      ) : reset ? (
        <div className="app-panel border border-border bg-surface p-6">
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {submitError ? (
              <PageBanner
                variant="error"
                title="Could not reset password"
                description={submitError}
              />
            ) : null}

            <AuthFormField
              id="email"
              label="Email"
              type="email"
              icon={Mail}
              value={reset.email}
              onChange={() => {}}
              readOnly
              required
            />
            <AuthFormField
              id="password"
              label="New password"
              type="password"
              icon={Lock}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={128}
              value={password}
              onChange={setPassword}
              hint={`At least ${MIN_PASSWORD_LENGTH} characters, at most 128 UTF-8 bytes.`}
              required
            />
            <AuthFormField
              id="confirm-password"
              label="Confirm password"
              type="password"
              icon={Lock}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={128}
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
            />

            <button
              type="submit"
              disabled={submitting}
              className="sm-btn sm-btn-primary sm-btn-block mt-1 inline-flex items-center justify-center gap-2"
            >
              {submitting ? 'Updating password…' : 'Update password'}
              {!submitting ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
            </button>
          </form>
        </div>
      ) : null}

      {!loadError && !sessionLoading && !session ? (
        <div className="mt-6">
          <AuthFooterLink prompt="Remember your password?" linkLabel="Sign in" to="/login" />
        </div>
      ) : null}
    </AuthLayout>
  )
}
